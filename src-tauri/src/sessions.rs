use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionTool {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub available: bool,
    pub category: String, // "editor", "terminal", "ai"
}

/// Check if a command exists on PATH
fn command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Detect available session tools
pub fn detect_tools() -> Vec<SessionTool> {
    let tools = vec![
        ("vscode", "VS Code", "code", vec!["."], "editor"),
        (
            "terminal",
            "Terminal",
            "open",
            vec!["-a", "Terminal", "."],
            "terminal",
        ),
        ("claude-code", "Claude Code", "claude", vec![], "ai"),
        ("gh-copilot", "GitHub Copilot", "gh", vec!["copilot"], "ai"),
        ("codex", "Codex", "codex", vec![], "ai"),
        ("opencode", "OpenCode", "opencode", vec![], "ai"),
    ];

    tools
        .into_iter()
        .map(|(id, name, cmd, args, category)| SessionTool {
            id: id.to_string(),
            name: name.to_string(),
            command: cmd.to_string(),
            args: args.into_iter().map(String::from).collect(),
            available: command_exists(cmd),
            category: category.to_string(),
        })
        .collect()
}

/// Launch a tool in a repository directory
pub fn launch_tool(tool_id: &str, repo_path: &str) -> Result<(), String> {
    let tools = detect_tools();
    let tool = tools
        .iter()
        .find(|t| t.id == tool_id)
        .ok_or_else(|| format!("Unknown tool: {}", tool_id))?;

    if !tool.available {
        return Err(format!(
            "{} is not installed or not found on PATH",
            tool.name
        ));
    }

    let mut cmd = Command::new(&tool.command);
    cmd.args(&tool.args);
    cmd.current_dir(repo_path);

    // For terminal and editors, we spawn and detach
    cmd.spawn()
        .map_err(|e| format!("Failed to launch {}: {}", tool.name, e))?;

    Ok(())
}

// -- Tauri commands --

#[tauri::command]
pub fn detect_session_tools() -> Vec<SessionTool> {
    detect_tools()
}

#[tauri::command]
pub fn launch_session(tool_id: String, repo_path: String) -> Result<(), String> {
    launch_tool(&tool_id, &repo_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_tools_returns_list() {
        let tools = detect_tools();
        assert!(!tools.is_empty());
        // VS Code entry should always be in the list (available or not)
        assert!(tools.iter().any(|t| t.id == "vscode"));
    }

    #[test]
    fn test_launch_unknown_tool() {
        let result = launch_tool("nonexistent", "/tmp");
        assert!(result.is_err());
    }
}
