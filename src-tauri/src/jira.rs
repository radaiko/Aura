use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION};
use serde::{Deserialize, Serialize};

// -- Public types returned to frontend --

#[derive(Debug, Serialize, Clone)]
pub struct JiraAuthStatus {
    pub valid: bool,
    pub display_name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct JiraIssue {
    pub key: String,
    pub summary: String,
    pub status: String,
    pub status_color: String,
    pub issue_type: String,
    pub priority: Option<String>,
    pub updated: String,
    pub url: String,
    pub labels: Vec<String>,
    pub project: String,
}

// -- Raw JSON shapes from Jira REST API --

#[derive(Deserialize)]
struct RawSearchResult {
    issues: Vec<RawIssue>,
}

#[derive(Deserialize)]
struct RawIssue {
    key: String,
    fields: RawIssueFields,
}

#[derive(Deserialize)]
struct RawIssueFields {
    summary: Option<String>,
    status: Option<RawStatus>,
    issuetype: Option<RawIssueType>,
    priority: Option<RawPriority>,
    updated: Option<String>,
    labels: Option<Vec<String>>,
    project: Option<RawProject>,
}

#[derive(Deserialize)]
struct RawStatus {
    name: Option<String>,
    #[serde(rename = "statusCategory")]
    status_category: Option<RawStatusCategory>,
}

#[derive(Deserialize)]
struct RawStatusCategory {
    #[serde(rename = "colorName")]
    color_name: Option<String>,
}

#[derive(Deserialize)]
struct RawIssueType {
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawPriority {
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawProject {
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawMyself {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "emailAddress")]
    email_address: Option<String>,
}

// -- Helpers --

fn basic_auth_value(email: &str, token: &str) -> String {
    use base64::Engine;
    let credentials = format!("{}:{}", email, token);
    let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
    format!("Basic {}", encoded)
}

fn build_headers(email: &str, token: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&basic_auth_value(email, token)).unwrap(),
    );
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers
}

fn normalize_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

// -- Tauri commands --

/// Verify Jira credentials by calling /rest/api/3/myself
#[tauri::command]
pub async fn check_jira_auth(
    instance_url: String,
    email: String,
    api_token: String,
) -> Result<JiraAuthStatus, String> {
    let base = normalize_url(&instance_url);

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/3/myself", base))
        .headers(build_headers(&email, &api_token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Ok(JiraAuthStatus {
            valid: false,
            display_name: None,
            email: Some(email),
        });
    }

    let myself: RawMyself = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(JiraAuthStatus {
        valid: true,
        display_name: myself.display_name,
        email: myself.email_address.or(Some(email)),
    })
}

/// Fetch open issues assigned to the current user
#[tauri::command]
pub async fn jira_fetch_issues(
    instance_url: String,
    email: String,
    api_token: String,
) -> Result<Vec<JiraIssue>, String> {
    let base = normalize_url(&instance_url);
    let jql = "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC";

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/3/search", base))
        .headers(build_headers(&email, &api_token))
        .query(&[
            ("jql", jql),
            ("maxResults", "100"),
            (
                "fields",
                "summary,status,issuetype,priority,updated,labels,project",
            ),
        ])
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Jira API error {}: {}", status, body));
    }

    let result: RawSearchResult = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let issues = result
        .issues
        .into_iter()
        .map(|raw| {
            let status_color = raw
                .fields
                .status
                .as_ref()
                .and_then(|s| s.status_category.as_ref())
                .and_then(|c| c.color_name.clone())
                .unwrap_or_default();

            JiraIssue {
                key: raw.key.clone(),
                summary: raw.fields.summary.unwrap_or_default(),
                status: raw
                    .fields
                    .status
                    .as_ref()
                    .and_then(|s| s.name.clone())
                    .unwrap_or_default(),
                status_color,
                issue_type: raw
                    .fields
                    .issuetype
                    .as_ref()
                    .and_then(|t| t.name.clone())
                    .unwrap_or_default(),
                priority: raw.fields.priority.and_then(|p| p.name),
                updated: raw.fields.updated.unwrap_or_default(),
                url: format!("{}/browse/{}", base, raw.key),
                labels: raw.fields.labels.unwrap_or_default(),
                project: raw
                    .fields
                    .project
                    .as_ref()
                    .and_then(|p| p.name.clone())
                    .unwrap_or_default(),
            }
        })
        .collect();

    Ok(issues)
}
