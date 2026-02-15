use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct LocalRepo {
    pub name: String,
    pub path: String,
    pub current_branch: String,
    pub is_dirty: bool,
}

/// Recursively scan for Git repos up to max_depth
fn find_repos(root: &Path, max_depth: u32, current_depth: u32) -> Vec<PathBuf> {
    if current_depth > max_depth {
        return vec![];
    }

    let mut repos = Vec::new();

    let entries = match std::fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return repos,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Skip hidden dirs (except .git) and common non-repo dirs
        if name_str.starts_with('.') || name_str == "node_modules" || name_str == "target" {
            continue;
        }

        // Check if this directory is a git repo
        if path.join(".git").exists() {
            repos.push(path);
            // Don't recurse into repos
            continue;
        }

        // Recurse into subdirectories
        repos.extend(find_repos(&path, max_depth, current_depth + 1));
    }

    repos
}

/// Get current branch name for a repo
fn get_current_branch(repo_path: &Path) -> String {
    Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "unknown".to_string())
}

/// Check if repo has uncommitted changes
fn is_repo_dirty(repo_path: &Path) -> bool {
    Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(repo_path)
        .output()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false)
}

/// Discover repos in given root directories
pub fn discover_repos(roots: &[String], max_depth: u32) -> Vec<LocalRepo> {
    let mut repos = Vec::new();

    for root in roots {
        let root_path = Path::new(root);
        if !root_path.exists() || !root_path.is_dir() {
            continue;
        }

        let found = find_repos(root_path, max_depth, 0);
        for repo_path in found {
            let name = repo_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            repos.push(LocalRepo {
                name,
                path: repo_path.to_string_lossy().to_string(),
                current_branch: get_current_branch(&repo_path),
                is_dirty: is_repo_dirty(&repo_path),
            });
        }
    }

    repos.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    repos
}

// -- Tauri commands --

#[tauri::command]
pub fn scan_repos(roots: Vec<String>, max_depth: Option<u32>) -> Vec<LocalRepo> {
    discover_repos(&roots, max_depth.unwrap_or(4))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_discover_repos_with_empty_roots() {
        let repos = discover_repos(&[], 4);
        assert!(repos.is_empty());
    }

    #[test]
    fn test_discover_repos_nonexistent_path() {
        let repos = discover_repos(&["/nonexistent/path/12345".to_string()], 4);
        assert!(repos.is_empty());
    }

    #[test]
    fn test_discover_repos_finds_self() {
        // cargo test runs from src-tauri/, so grandparent is the dev directory
        // containing the Aura repo
        let current_dir = env::current_dir().unwrap();
        let grandparent = current_dir
            .parent()
            .and_then(|p| p.parent())
            .unwrap()
            .to_string_lossy()
            .to_string();
        let repos = discover_repos(&[grandparent], 1);
        assert!(!repos.is_empty());
    }
}
