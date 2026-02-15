use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT, ACCEPT};
use serde::{Deserialize, Serialize};

const GITHUB_API: &str = "https://api.github.com";

fn build_headers(token: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
    );
    headers.insert(USER_AGENT, HeaderValue::from_static("Aura/0.1.0"));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );
    headers
}

// -- Data types --

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubUser {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
    pub html_url: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubLabel {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubIssue {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub user: GitHubUser,
    pub labels: Vec<GitHubLabel>,
    pub created_at: String,
    pub updated_at: String,
    pub body: Option<String>,
    pub pull_request: Option<serde_json::Value>, // present if this is a PR
    pub repository_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub total_count: u64,
    pub incomplete_results: bool,
    pub items: Vec<GitHubIssue>,
}

// -- API functions --

/// Fetch the authenticated user
pub async fn fetch_user(token: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/user", GITHUB_API))
        .headers(build_headers(token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    resp.json::<GitHubUser>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Fetch issues assigned to the authenticated user
pub async fn fetch_assigned_issues(token: &str) -> Result<Vec<GitHubIssue>, String> {
    let client = reqwest::Client::new();
    let mut all_issues = Vec::new();
    let mut page = 1u32;

    loop {
        let resp = client
            .get(format!(
                "{}/issues?filter=assigned&state=open&per_page=100&page={}",
                GITHUB_API, page
            ))
            .headers(build_headers(token))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GitHub API error {}: {}", status, body));
        }

        let issues: Vec<GitHubIssue> = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        let count = issues.len();
        // Filter out pull requests (they have a pull_request key)
        let real_issues: Vec<GitHubIssue> = issues
            .into_iter()
            .filter(|i| i.pull_request.is_none())
            .collect();

        all_issues.extend(real_issues);

        if count < 100 {
            break;
        }
        page += 1;
    }

    Ok(all_issues)
}

/// Fetch PRs where user is author or review-requested
pub async fn fetch_assigned_prs(token: &str, username: &str) -> Result<Vec<GitHubIssue>, String> {
    let client = reqwest::Client::new();
    let query = format!("type:pr is:open involves:{}", username);

    let resp = client
        .get(format!("{}/search/issues", GITHUB_API))
        .headers(build_headers(token))
        .query(&[
            ("q", query.as_str()),
            ("sort", "updated"),
            ("per_page", "100"),
        ])
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    let result: SearchResult = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(result.items)
}

// -- Tauri commands --

#[tauri::command]
pub async fn github_fetch_issues() -> Result<Vec<GitHubIssue>, String> {
    let token = crate::auth::extract_gh_token()?;
    fetch_assigned_issues(&token).await
}

#[tauri::command]
pub async fn github_fetch_prs() -> Result<Vec<GitHubIssue>, String> {
    let token = crate::auth::extract_gh_token()?;
    let username = crate::auth::get_gh_username()?;
    fetch_assigned_prs(&token, &username).await
}

#[tauri::command]
pub async fn github_fetch_user() -> Result<GitHubUser, String> {
    let token = crate::auth::extract_gh_token()?;
    fetch_user(&token).await
}
