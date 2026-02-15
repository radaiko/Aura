use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;

// -- Public types returned to frontend --

#[derive(Debug, Serialize, Clone)]
pub struct FogBugzAuthStatus {
    pub valid: bool,
    pub person_name: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FogBugzCase {
    pub id: i64,
    pub title: String,
    pub status: String,
    pub category: String,
    pub priority: Option<String>,
    pub project: String,
    pub area: String,
    pub updated: String,
    pub url: String,
    pub tags: Vec<String>,
    pub is_open: bool,
}

// -- Raw JSON shapes from FogBugz JSON API --

#[derive(Deserialize)]
struct RawLogonResponse {
    data: Option<RawLogonData>,
    errors: Option<Vec<RawError>>,
}

#[derive(Deserialize)]
struct RawLogonData {
    token: Option<String>,
}

#[derive(Deserialize)]
struct RawApiResponse {
    data: Option<RawData>,
    errors: Option<Vec<RawError>>,
    #[serde(rename = "errorCode")]
    error_code: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct RawData {
    cases: Option<Vec<RawCase>>,
    person: Option<RawPerson>,
}

#[derive(Deserialize)]
struct RawError {
    message: Option<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct RawCase {
    ixBug: Option<i64>,
    sTitle: Option<String>,
    sStatus: Option<String>,
    sCategory: Option<String>,
    sPriority: Option<String>,
    sProject: Option<String>,
    sArea: Option<String>,
    dtLastUpdated: Option<String>,
    tags: Option<Vec<String>>,
    fOpen: Option<bool>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct RawPerson {
    sFullName: Option<String>,
}

// -- Helpers --

fn build_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    headers
}

fn normalize_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn check_api_errors(resp: &RawApiResponse) -> Result<(), String> {
    if let Some(errors) = &resp.errors {
        let msgs: Vec<String> = errors
            .iter()
            .filter_map(|e| e.message.clone())
            .collect();
        if !msgs.is_empty() {
            return Err(format!("FogBugz API error: {}", msgs.join("; ")));
        }
    }
    if let Some(code) = &resp.error_code {
        if !code.is_null() {
            return Err(format!("FogBugz error code: {}", code));
        }
    }
    Ok(())
}

/// Log in with email/password and return a session token
async fn logon(
    client: &reqwest::Client,
    base: &str,
    email: &str,
    password: &str,
) -> Result<String, String> {
    let resp = client
        .post(format!("{}/api/logon", base))
        .headers(build_headers())
        .json(&json!({
            "email": email,
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Logon request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Logon failed ({}): {}", status, body));
    }

    let logon_resp: RawLogonResponse = resp
        .json()
        .await
        .map_err(|e| format!("Logon parse error: {}", e))?;

    if let Some(errors) = &logon_resp.errors {
        let msgs: Vec<String> = errors
            .iter()
            .filter_map(|e| e.message.clone())
            .collect();
        if !msgs.is_empty() {
            return Err(format!("Logon failed: {}", msgs.join("; ")));
        }
    }

    logon_resp
        .data
        .and_then(|d| d.token)
        .ok_or_else(|| "Logon succeeded but no token returned".to_string())
}

// -- Tauri commands --

/// Verify FogBugz credentials by logging in
#[tauri::command]
pub async fn check_fogbugz_auth(
    instance_url: String,
    email: String,
    password: String,
) -> Result<FogBugzAuthStatus, String> {
    let base = normalize_url(&instance_url);
    let client = reqwest::Client::new();

    let token = match logon(&client, &base, &email, &password).await {
        Ok(t) => t,
        Err(_) => {
            return Ok(FogBugzAuthStatus {
                valid: false,
                person_name: None,
            });
        }
    };

    // Try to get current person info via viewPerson
    let resp = client
        .post(format!("{}/api/viewPerson", base))
        .headers(build_headers())
        .json(&json!({ "token": token }))
        .send()
        .await;

    let person_name = if let Ok(resp) = resp {
        resp.json::<RawApiResponse>()
            .await
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.person)
            .and_then(|p| p.sFullName)
    } else {
        None
    };

    Ok(FogBugzAuthStatus {
        valid: true,
        person_name,
    })
}

/// Fetch open cases assigned to the current user
#[tauri::command]
pub async fn fogbugz_fetch_cases(
    instance_url: String,
    email: String,
    password: String,
) -> Result<Vec<FogBugzCase>, String> {
    let base = normalize_url(&instance_url);
    let client = reqwest::Client::new();

    let token = logon(&client, &base, &email, &password).await?;

    let resp = client
        .post(format!("{}/api/search", base))
        .headers(build_headers())
        .json(&json!({
            "token": token,
            "q": "assignedto:me status:active",
            "cols": [
                "ixBug", "sTitle", "sStatus", "sCategory", "sPriority",
                "sProject", "sArea", "dtLastUpdated", "tags", "fOpen"
            ],
            "max": 200
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("FogBugz API error {}: {}", status, body));
    }

    let api_resp: RawApiResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    check_api_errors(&api_resp)?;

    let cases = api_resp
        .data
        .and_then(|d| d.cases)
        .unwrap_or_default()
        .into_iter()
        .map(|raw| {
            let id = raw.ixBug.unwrap_or(0);
            FogBugzCase {
                id,
                title: raw.sTitle.unwrap_or_default(),
                status: raw.sStatus.unwrap_or_default(),
                category: raw.sCategory.unwrap_or_default(),
                priority: raw.sPriority,
                project: raw.sProject.unwrap_or_default(),
                area: raw.sArea.unwrap_or_default(),
                updated: raw.dtLastUpdated.unwrap_or_default(),
                url: format!("{}/f/cases/{}", base, id),
                tags: raw.tags.unwrap_or_default(),
                is_open: raw.fOpen.unwrap_or(true),
            }
        })
        .collect();

    Ok(cases)
}
