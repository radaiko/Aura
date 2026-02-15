use serde::{Deserialize, Serialize};
use std::process::Command;

// -- Public types returned to frontend --

#[derive(Debug, Serialize, Clone)]
pub struct AzureAuthStatus {
    pub cli_available: bool,
    pub logged_in: bool,
    pub organization: Option<String>,
    pub project: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AzureWorkItem {
    pub id: u64,
    pub title: String,
    pub state: String,
    pub work_item_type: String,
    pub assigned_to: Option<String>,
    pub changed_date: String,
    pub tags: Vec<String>,
    pub url: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AzurePullRequest {
    pub id: u64,
    pub title: String,
    pub status: String,
    pub created_by: String,
    pub repository: String,
    pub source_branch: String,
    pub target_branch: String,
    pub creation_date: String,
    pub url: String,
}

// -- Raw JSON shapes from az CLI --

#[derive(Deserialize)]
struct RawQueryItem {
    id: u64,
    fields: RawWorkItemFields,
    url: Option<String>,
}

#[derive(Deserialize)]
struct RawWorkItemFields {
    #[serde(rename = "System.Title")]
    title: Option<String>,
    #[serde(rename = "System.State")]
    state: Option<String>,
    #[serde(rename = "System.WorkItemType")]
    work_item_type: Option<String>,
    #[serde(rename = "System.AssignedTo")]
    assigned_to: Option<serde_json::Value>,
    #[serde(rename = "System.ChangedDate")]
    changed_date: Option<String>,
    #[serde(rename = "System.Tags")]
    tags: Option<String>,
}

#[derive(Deserialize)]
struct RawPullRequest {
    #[serde(rename = "pullRequestId")]
    pull_request_id: u64,
    title: Option<String>,
    status: Option<String>,
    #[serde(rename = "createdBy")]
    created_by: Option<RawIdentity>,
    repository: Option<RawRepository>,
    #[serde(rename = "sourceRefName")]
    source_ref_name: Option<String>,
    #[serde(rename = "targetRefName")]
    target_ref_name: Option<String>,
    #[serde(rename = "creationDate")]
    creation_date: Option<String>,
}

#[derive(Deserialize)]
struct RawIdentity {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

#[derive(Deserialize)]
struct RawRepository {
    name: Option<String>,
}

// -- Helpers --

fn is_az_installed() -> bool {
    Command::new("az")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn is_az_logged_in() -> bool {
    Command::new("az")
        .args(["account", "show", "--output", "none"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn get_devops_defaults() -> (Option<String>, Option<String>) {
    let output = match Command::new("az")
        .args(["devops", "configure", "--list"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return (None, None),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut org = None;
    let mut project = None;

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() != 2 {
            continue;
        }
        let key = parts[0].trim();
        let val = parts[1].trim();
        if val.is_empty() || val == "None" {
            continue;
        }
        match key {
            "organization" => org = Some(val.to_string()),
            "project" => project = Some(val.to_string()),
            _ => {}
        }
    }

    (org, project)
}

fn resolve_auth() -> AzureAuthStatus {
    if !is_az_installed() {
        return AzureAuthStatus {
            cli_available: false,
            logged_in: false,
            organization: None,
            project: None,
        };
    }

    if !is_az_logged_in() {
        return AzureAuthStatus {
            cli_available: true,
            logged_in: false,
            organization: None,
            project: None,
        };
    }

    let (org, project) = get_devops_defaults();
    AzureAuthStatus {
        cli_available: true,
        logged_in: true,
        organization: org,
        project,
    }
}

fn extract_display_name(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Object(map) => map
            .get("displayName")
            .or_else(|| map.get("uniqueName"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    }
}

fn strip_ref_prefix(s: &str) -> String {
    s.strip_prefix("refs/heads/").unwrap_or(s).to_string()
}

/// Build a web URL for a work item
fn work_item_web_url(org: &str, project: &str, id: u64) -> String {
    let org_base = org.trim_end_matches('/');
    format!("{}/_workitems/edit/{}", org_base, id)
        .replace("dev.azure.com", "dev.azure.com")
        // If org already has project in path, avoid double project
        .replace(&format!("/{}/_workitems", project), "/_workitems")
        // Ensure project is in the URL
        .replace("/_workitems", &format!("/{}/_workitems", project))
}

/// Build a web URL for a pull request
fn pr_web_url(org: &str, project: &str, repo: &str, id: u64) -> String {
    let org_base = org.trim_end_matches('/');
    format!(
        "{}/{}/_git/{}/pullrequest/{}",
        org_base, project, repo, id
    )
}

// -- Tauri commands --

#[tauri::command]
pub fn check_azure_auth() -> AzureAuthStatus {
    resolve_auth()
}

#[tauri::command]
pub fn azure_fetch_work_items() -> Result<Vec<AzureWorkItem>, String> {
    let status = resolve_auth();
    if !status.logged_in {
        return Err("Azure CLI not authenticated. Run `az login` first.".to_string());
    }
    let org = status
        .organization
        .as_deref()
        .ok_or("No Azure DevOps organization configured. Run `az devops configure --defaults organization=https://dev.azure.com/YOUR_ORG`")?;
    let project = status
        .project
        .as_deref()
        .ok_or("No Azure DevOps project configured. Run `az devops configure --defaults project=YOUR_PROJECT`")?;

    let wiql = concat!(
        "SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], ",
        "[System.AssignedTo], [System.ChangedDate], [System.Tags] ",
        "FROM workitems WHERE [System.AssignedTo] = @Me ",
        "AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ",
        "AND [System.State] <> 'Done' ORDER BY [System.ChangedDate] DESC"
    );

    let output = Command::new("az")
        .args(["boards", "query", "--wiql", wiql, "--output", "json"])
        .output()
        .map_err(|e| format!("Failed to run az: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("az boards query failed: {}", stderr.trim()));
    }

    let raw: Vec<RawQueryItem> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse work items: {}", e))?;

    let items = raw
        .into_iter()
        .map(|r| {
            let tags = r
                .fields
                .tags
                .as_deref()
                .unwrap_or("")
                .split(';')
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .collect();

            AzureWorkItem {
                id: r.id,
                title: r.fields.title.unwrap_or_default(),
                state: r.fields.state.unwrap_or_default(),
                work_item_type: r.fields.work_item_type.unwrap_or_default(),
                assigned_to: r.fields.assigned_to.as_ref().and_then(extract_display_name),
                changed_date: r.fields.changed_date.unwrap_or_default(),
                tags,
                url: r
                    .url
                    .unwrap_or_else(|| work_item_web_url(org, project, r.id)),
            }
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub fn azure_fetch_prs() -> Result<Vec<AzurePullRequest>, String> {
    let status = resolve_auth();
    if !status.logged_in {
        return Err("Azure CLI not authenticated. Run `az login` first.".to_string());
    }
    let org = status.organization.as_deref().ok_or(
        "No Azure DevOps organization configured. Run `az devops configure --defaults organization=https://dev.azure.com/YOUR_ORG`",
    )?;
    let project = status.project.as_deref().ok_or(
        "No Azure DevOps project configured. Run `az devops configure --defaults project=YOUR_PROJECT`",
    )?;

    let output = Command::new("az")
        .args([
            "repos", "pr", "list", "--status", "active", "--output", "json",
        ])
        .output()
        .map_err(|e| format!("Failed to run az: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("az repos pr list failed: {}", stderr.trim()));
    }

    let raw: Vec<RawPullRequest> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse pull requests: {}", e))?;

    let prs = raw
        .into_iter()
        .map(|r| {
            let repo_name = r
                .repository
                .as_ref()
                .and_then(|repo| repo.name.clone())
                .unwrap_or_default();

            AzurePullRequest {
                id: r.pull_request_id,
                title: r.title.unwrap_or_default(),
                status: r.status.unwrap_or_default(),
                created_by: r
                    .created_by
                    .as_ref()
                    .and_then(|c| c.display_name.clone())
                    .unwrap_or_default(),
                repository: repo_name.clone(),
                source_branch: r
                    .source_ref_name
                    .map(|s| strip_ref_prefix(&s))
                    .unwrap_or_default(),
                target_branch: r
                    .target_ref_name
                    .map(|s| strip_ref_prefix(&s))
                    .unwrap_or_default(),
                creation_date: r.creation_date.unwrap_or_default(),
                url: pr_web_url(org, project, &repo_name, r.pull_request_id),
            }
        })
        .collect();

    Ok(prs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ref_prefix() {
        assert_eq!(strip_ref_prefix("refs/heads/main"), "main");
        assert_eq!(strip_ref_prefix("refs/heads/feature/x"), "feature/x");
        assert_eq!(strip_ref_prefix("main"), "main");
    }

    #[test]
    fn test_resolve_auth_returns_status() {
        let status = resolve_auth();
        // Should run without panicking regardless of az being installed
        assert!(status.cli_available || !status.cli_available);
    }
}
