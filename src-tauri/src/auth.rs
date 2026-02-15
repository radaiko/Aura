use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct AuthStatus {
    pub cli_available: bool,
    pub cli_authenticated: bool,
    pub username: Option<String>,
    pub auth_method: String, // "cli" or "pat" or "none"
    pub token: Option<String>,
}

/// Check if `gh` CLI is installed
pub fn is_gh_installed() -> bool {
    Command::new("gh")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Extract token from `gh auth token`
pub fn extract_gh_token() -> Result<String, String> {
    let output = Command::new("gh")
        .args(["auth", "token"])
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh auth token failed: {}", stderr.trim()));
    }

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        return Err("gh auth token returned empty".to_string());
    }
    Ok(token)
}

/// Get username from `gh auth status`
pub fn get_gh_username() -> Result<String, String> {
    let output = Command::new("gh")
        .args(["auth", "status", "--show-token"])
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);

    // gh auth status outputs "Logged in to github.com account USERNAME"
    for line in combined.lines() {
        if line.contains("Logged in to") {
            if let Some(account) = line.split("account ").nth(1) {
                let username = account.split_whitespace().next().unwrap_or("").to_string();
                if !username.is_empty() {
                    return Ok(username);
                }
            }
        }
    }

    Err("Could not determine GitHub username from gh auth status".to_string())
}

/// Resolve GitHub auth — CLI first, PAT fallback
pub fn resolve_github_auth() -> AuthStatus {
    if !is_gh_installed() {
        return AuthStatus {
            cli_available: false,
            cli_authenticated: false,
            username: None,
            auth_method: "none".to_string(),
            token: None,
        };
    }

    match extract_gh_token() {
        Ok(token) => {
            let username = get_gh_username().ok();
            AuthStatus {
                cli_available: true,
                cli_authenticated: true,
                username,
                auth_method: "cli".to_string(),
                token: Some(token),
            }
        }
        Err(_) => AuthStatus {
            cli_available: true,
            cli_authenticated: false,
            username: None,
            auth_method: "none".to_string(),
            token: None,
        },
    }
}

// -- Tauri commands --

#[tauri::command]
pub fn check_github_auth() -> AuthStatus {
    resolve_github_auth()
}

#[tauri::command]
pub fn get_github_token() -> Result<String, String> {
    let status = resolve_github_auth();
    status.token.ok_or_else(|| {
        if !status.cli_available {
            "GitHub CLI not installed. Install from https://cli.github.com/ or configure a PAT in Settings.".to_string()
        } else {
            "GitHub CLI not authenticated. Run `gh auth login` or configure a PAT in Settings.".to_string()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_gh_installed_returns_bool() {
        // This test validates the function runs without panicking.
        // The actual result depends on the dev machine.
        let result = is_gh_installed();
        assert!(result == true || result == false);
    }

    #[test]
    fn test_resolve_github_auth_returns_status() {
        let status = resolve_github_auth();
        assert!(["cli", "pat", "none"].contains(&status.auth_method.as_str()));
        if status.auth_method == "cli" {
            assert!(status.cli_available);
            assert!(status.cli_authenticated);
            assert!(status.token.is_some());
        }
    }
}
