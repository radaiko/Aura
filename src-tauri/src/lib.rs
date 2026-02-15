mod auth;
mod azure;
mod fogbugz;
mod github;
mod jira;
mod repos;
mod sessions;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:aura.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            auth::check_github_auth,
            auth::get_github_token,
            github::github_fetch_issues,
            github::github_fetch_prs,
            github::github_fetch_user,
            repos::scan_repos,
            repos::list_directories,
            sessions::detect_session_tools,
            sessions::launch_session,
            azure::check_azure_auth,
            azure::azure_fetch_work_items,
            azure::azure_fetch_prs,
            jira::check_jira_auth,
            jira::jira_fetch_issues,
            fogbugz::check_fogbugz_auth,
            fogbugz::fogbugz_fetch_cases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
