# Phase 1: Foundation (MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Tauri v2 desktop app where a developer can authenticate via GitHub CLI, view assigned issues and PRs, browse local repos, and launch coding sessions.

**Architecture:** Tauri v2 (Rust backend + React webview frontend). Rust handles auth, API calls, filesystem scanning, and process spawning. React renders the UI and communicates with Rust via `invoke()` IPC. SQLite stores settings and cached data locally.

**Tech Stack:** Tauri v2, React 19, TypeScript, Tailwind CSS v4, Vite, pnpm, SQLite (via tauri-plugin-sql), reqwest (Rust HTTP), serde (Rust serialization), vitest + jsdom (frontend tests), cargo test (backend tests)

**Reference:** `docs/requirements.md` (FR-001, FR-004, FR-010, FR-015, FR-016, FR-020, NFR-001, NFR-003)

---

## Task 1: Project Scaffold

**Files:**
- Create: entire project structure via `pnpm create tauri-app`
- Modify: `vite.config.ts` (add Tailwind)
- Modify: `src/index.css` (add Tailwind import)
- Create: `vitest.config.ts`
- Modify: `package.json` (add test scripts)

**Step 1: Scaffold Tauri v2 project**

```bash
cd /Users/radaiko/dev/Aura
# Remove the stale firebase log
rm firebase-debug.log
# Scaffold — interactive: select pnpm, React, TypeScript
pnpm create tauri-app aura-app
```

When prompted:
- Project name: `aura-app`
- Package manager: `pnpm`
- UI template: `React`
- UI flavor: `TypeScript`

**Step 2: Move scaffold contents to repo root**

The scaffold creates a subdirectory. Move its contents to the repo root:

```bash
# Move all contents (including hidden files) from aura-app/ to repo root
shopt -s dotglob
mv aura-app/* .
rmdir aura-app
```

**Step 3: Install dependencies and verify dev server**

```bash
pnpm install
pnpm tauri dev
```

Expected: Tauri window opens with the default React template. Close the window.

**Step 4: Add Tailwind CSS v4**

```bash
pnpm add tailwindcss @tailwindcss/vite
```

Modify `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

Replace contents of `src/index.css`:

```css
@import "tailwindcss";
```

**Step 5: Add vitest**

```bash
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

Create `src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 6: Verify Tailwind works**

Replace `src/App.tsx` with a minimal Tailwind test:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <h1 className="text-3xl font-bold">Aura</h1>
    </div>
  );
}

export default App;
```

Remove `src/App.css` (no longer needed).

```bash
pnpm tauri dev
```

Expected: Dark window with "Aura" centered in white bold text.

**Step 7: Write a smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the app name", () => {
    render(<App />);
    expect(screen.getByText("Aura")).toBeInTheDocument();
  });
});
```

```bash
pnpm test
```

Expected: 1 test passes.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri v2 + React + TypeScript + Tailwind + vitest"
```

---

## Task 2: Tauri Plugins & Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`

**Step 1: Add Tauri plugins**

```bash
pnpm tauri add sql
pnpm tauri add shell
```

**Step 2: Enable SQLite feature in Cargo.toml**

In `src-tauri/Cargo.toml`, ensure the sql plugin has the `sqlite` feature:

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**Step 3: Add Rust dependencies**

```bash
cd src-tauri
cargo add reqwest --features json,rustls-tls
cargo add serde --features derive
cargo add serde_json
cargo add tokio --features process
cargo add keyring
cd ..
```

**Step 4: Install frontend plugin packages**

```bash
pnpm add @tauri-apps/plugin-sql @tauri-apps/plugin-shell
```

**Step 5: Register plugins in lib.rs**

Ensure `src-tauri/src/lib.rs` registers all plugins:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 6: Configure shell plugin permissions**

In `src-tauri/capabilities/default.json`, add shell permissions for executing `gh`, `code`, and other tools. The exact format depends on the generated scaffold — add to the `permissions` array:

```json
"shell:allow-execute",
"shell:allow-open",
"sql:default"
```

**Step 7: Verify build**

```bash
pnpm tauri build --debug
```

Expected: Builds without errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Tauri plugins (sql, shell) and Rust dependencies"
```

---

## Task 3: Database Schema & App Layout

**Files:**
- Create: `src-tauri/migrations/001_init.sql`
- Modify: `src-tauri/src/lib.rs` (run migrations on startup)
- Create: `src/layouts/AppLayout.tsx`
- Create: `src/pages/IssuesPage.tsx`
- Create: `src/pages/PullRequestsPage.tsx`
- Create: `src/pages/ReposPage.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

**Step 1: Create database migration**

Create `src-tauri/migrations/001_init.sql`:

```sql
-- Connections to external providers
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('github')),
    label TEXT NOT NULL,
    auth_method TEXT NOT NULL CHECK (auth_method IN ('cli', 'pat')),
    username TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configurable root directories for repo scanning
CREATE TABLE IF NOT EXISTS scan_roots (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

**Step 2: Configure SQL plugin to run migrations**

Update `src-tauri/src/lib.rs` to load migrations:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:aura.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Create app layout with sidebar navigation**

Create `src/layouts/AppLayout.tsx`:

```tsx
import { ReactNode, useState } from "react";

type Page = "issues" | "prs" | "repos" | "settings";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "issues", label: "Issues" },
  { id: "prs", label: "Pull Requests" },
  { id: "repos", label: "Repositories" },
  { id: "settings", label: "Settings" },
];

export function AppLayout({
  activePage,
  onNavigate,
  children,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <nav className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-1">
        <h1 className="text-lg font-bold mb-4 px-2">Aura</h1>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
              activePage === item.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

export type { Page };
```

**Step 4: Create placeholder pages**

Create `src/pages/IssuesPage.tsx`:

```tsx
export function IssuesPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Issues</h2>
      <p className="text-zinc-400">Connect a GitHub account in Settings to view assigned issues.</p>
    </div>
  );
}
```

Create `src/pages/PullRequestsPage.tsx`:

```tsx
export function PullRequestsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Pull Requests</h2>
      <p className="text-zinc-400">Connect a GitHub account in Settings to view pull requests.</p>
    </div>
  );
}
```

Create `src/pages/ReposPage.tsx`:

```tsx
export function ReposPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Repositories</h2>
      <p className="text-zinc-400">Add scan directories in Settings to discover local repositories.</p>
    </div>
  );
}
```

Create `src/pages/SettingsPage.tsx`:

```tsx
export function SettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <p className="text-zinc-400">Settings will appear here.</p>
    </div>
  );
}
```

**Step 5: Wire up App.tsx with navigation**

Replace `src/App.tsx`:

```tsx
import { useState } from "react";
import { AppLayout, type Page } from "./layouts/AppLayout";
import { IssuesPage } from "./pages/IssuesPage";
import { PullRequestsPage } from "./pages/PullRequestsPage";
import { ReposPage } from "./pages/ReposPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [page, setPage] = useState<Page>("issues");

  return (
    <AppLayout activePage={page} onNavigate={setPage}>
      {page === "issues" && <IssuesPage />}
      {page === "prs" && <PullRequestsPage />}
      {page === "repos" && <ReposPage />}
      {page === "settings" && <SettingsPage />}
    </AppLayout>
  );
}

export default App;
```

**Step 6: Verify UI**

```bash
pnpm tauri dev
```

Expected: Dark app with sidebar navigation. Clicking each nav item shows the placeholder page. Database file `aura.db` is created automatically.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add database schema, app layout, and page navigation"
```

---

## Task 4: Auth Resolution Layer

**Files:**
- Create: `src-tauri/src/auth.rs`
- Modify: `src-tauri/src/lib.rs` (register commands)

**Step 1: Write tests for auth module**

Create `src-tauri/src/auth.rs`:

```rust
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
```

**Step 2: Register auth commands in lib.rs**

Modify `src-tauri/src/lib.rs`:

```rust
mod auth;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
    ];

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test && cd ..
```

Expected: Tests pass.

**Step 4: Verify from frontend**

Temporarily add to any page component to test the IPC:

```tsx
import { invoke } from "@tauri-apps/api/core";

// In a useEffect or button click:
const status = await invoke("check_github_auth");
console.log(status);
```

Run `pnpm tauri dev` and check console. Expected: AuthStatus object with your GitHub CLI state.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add GitHub auth resolution layer (CLI-first with PAT fallback)"
```

---

## Task 5: GitHub API Client

**Files:**
- Create: `src-tauri/src/github.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create GitHub API client**

Create `src-tauri/src/github.rs`:

```rust
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

#[derive(Debug, Serialize, Clone)]
pub struct RateLimitInfo {
    pub remaining: u32,
    pub limit: u32,
    pub reset: u64,
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
    let query = format!(
        "type:pr is:open (author:{} OR review-requested:{})",
        username, username
    );

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
```

**Step 2: Register GitHub commands**

Update `src-tauri/src/lib.rs` invoke handler:

```rust
mod auth;
mod github;

// ... in run():
.invoke_handler(tauri::generate_handler![
    auth::check_github_auth,
    auth::get_github_token,
    github::github_fetch_issues,
    github::github_fetch_prs,
    github::github_fetch_user,
])
```

**Step 3: Verify build**

```bash
cd src-tauri && cargo build && cd ..
```

Expected: Compiles without errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add GitHub API client (issues, PRs, user)"
```

---

## Task 6: TypeScript Types & API Hooks

**Files:**
- Create: `src/types.ts`
- Create: `src/hooks/useGitHub.ts`

**Step 1: Define shared TypeScript types**

Create `src/types.ts`:

```typescript
export interface AuthStatus {
  cli_available: boolean;
  cli_authenticated: boolean;
  username: string | null;
  auth_method: "cli" | "pat" | "none";
  token: string | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
  body: string | null;
  pull_request: unknown | null;
  repository_url: string;
}

/** Extract "owner/repo" from repository_url */
export function repoFromUrl(url: string): string {
  // https://api.github.com/repos/owner/repo -> owner/repo
  const match = url.match(/repos\/(.+)$/);
  return match ? match[1] : url;
}
```

**Step 2: Create React hook for GitHub data**

Create `src/hooks/useGitHub.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AuthStatus, GitHubIssue, GitHubUser } from "../types";

export function useGitHubAuth() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<AuthStatus>("check_github_auth");
      setStatus(result);
    } catch (err) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}

export function useGitHubIssues() {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<GitHubIssue[]>("github_fetch_issues");
      setIssues(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { issues, loading, error, fetch };
}

export function useGitHubPRs() {
  const [prs, setPrs] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<GitHubIssue[]>("github_fetch_prs");
      setPrs(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { prs, loading, error, fetch };
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add TypeScript types and React hooks for GitHub data"
```

---

## Task 7: Issues & Pull Requests UI

**Files:**
- Modify: `src/pages/IssuesPage.tsx`
- Modify: `src/pages/PullRequestsPage.tsx`
- Create: `src/components/IssueList.tsx`

**Step 1: Create reusable issue/PR list component**

Create `src/components/IssueList.tsx`:

```tsx
import type { GitHubIssue } from "../types";
import { repoFromUrl } from "../types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function IssueList({
  items,
  loading,
  error,
  emptyMessage,
  onRetry,
}: {
  items: GitHubIssue[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return <p className="text-zinc-500 animate-pulse">Loading...</p>;
  }

  if (error) {
    return (
      <div className="text-red-400">
        <p>{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-zinc-400 hover:text-white underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2.5 rounded-md hover:bg-zinc-900 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">
                  {item.title}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {repoFromUrl(item.repository_url)} #{item.number}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.labels.slice(0, 3).map((label) => (
                  <span
                    key={label.name}
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `#${label.color}20`,
                      color: `#${label.color}`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
                <span className="text-xs text-zinc-600">
                  {timeAgo(item.updated_at)}
                </span>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
```

**Step 2: Wire up Issues page**

Replace `src/pages/IssuesPage.tsx`:

```tsx
import { useEffect } from "react";
import { useGitHubAuth, useGitHubIssues } from "../hooks/useGitHub";
import { IssueList } from "../components/IssueList";

export function IssuesPage() {
  const { status, loading: authLoading } = useGitHubAuth();
  const { issues, loading, error, fetch } = useGitHubIssues();

  useEffect(() => {
    if (status?.auth_method !== "none") {
      fetch();
    }
  }, [status, fetch]);

  if (authLoading) {
    return <p className="text-zinc-500 animate-pulse">Checking authentication...</p>;
  }

  if (!status || status.auth_method === "none") {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Issues</h2>
        <p className="text-zinc-400">
          {status?.cli_available
            ? "GitHub CLI is not authenticated. Run `gh auth login` in your terminal."
            : "GitHub CLI not found. Install from https://cli.github.com/ or configure a PAT in Settings."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Issues
          {status.username && (
            <span className="text-sm text-zinc-500 font-normal ml-2">
              @{status.username}
            </span>
          )}
        </h2>
        <button
          onClick={fetch}
          disabled={loading}
          className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <IssueList
        items={issues}
        loading={loading}
        error={error}
        emptyMessage="No open issues assigned to you."
        onRetry={fetch}
      />
    </div>
  );
}
```

**Step 3: Wire up Pull Requests page**

Replace `src/pages/PullRequestsPage.tsx`:

```tsx
import { useEffect } from "react";
import { useGitHubAuth, useGitHubPRs } from "../hooks/useGitHub";
import { IssueList } from "../components/IssueList";

export function PullRequestsPage() {
  const { status, loading: authLoading } = useGitHubAuth();
  const { prs, loading, error, fetch } = useGitHubPRs();

  useEffect(() => {
    if (status?.auth_method !== "none") {
      fetch();
    }
  }, [status, fetch]);

  if (authLoading) {
    return <p className="text-zinc-500 animate-pulse">Checking authentication...</p>;
  }

  if (!status || status.auth_method === "none") {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Pull Requests</h2>
        <p className="text-zinc-400">
          {status?.cli_available
            ? "GitHub CLI is not authenticated. Run `gh auth login` in your terminal."
            : "GitHub CLI not found. Install from https://cli.github.com/ or configure a PAT in Settings."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Pull Requests
          {status.username && (
            <span className="text-sm text-zinc-500 font-normal ml-2">
              @{status.username}
            </span>
          )}
        </h2>
        <button
          onClick={fetch}
          disabled={loading}
          className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <IssueList
        items={prs}
        loading={loading}
        error={error}
        emptyMessage="No open pull requests for you."
        onRetry={fetch}
      />
    </div>
  );
}
```

**Step 4: Verify**

```bash
pnpm tauri dev
```

Expected: Issues page shows your assigned GitHub issues. PR page shows your PRs. If `gh` is authenticated, data loads. If not, a helpful message is shown.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Issues and Pull Requests views with GitHub data"
```

---

## Task 8: Local Repository Discovery

**Files:**
- Create: `src-tauri/src/repos.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create repo discovery module**

Create `src-tauri/src/repos.rs`:

```rust
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
        // This repo itself should be discoverable from parent dir
        let current_dir = env::current_dir().unwrap();
        let parent = current_dir.parent().unwrap().to_string_lossy().to_string();
        let repos = discover_repos(&[parent], 1);
        assert!(!repos.is_empty());
    }
}
```

**Step 2: Register repo commands**

Update `src-tauri/src/lib.rs`:

```rust
mod auth;
mod github;
mod repos;

// ... in invoke_handler:
.invoke_handler(tauri::generate_handler![
    auth::check_github_auth,
    auth::get_github_token,
    github::github_fetch_issues,
    github::github_fetch_prs,
    github::github_fetch_user,
    repos::scan_repos,
])
```

**Step 3: Run tests**

```bash
cd src-tauri && cargo test && cd ..
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add local repository discovery with git status"
```

---

## Task 9: Repositories UI

**Files:**
- Modify: `src/pages/ReposPage.tsx`
- Create: `src/hooks/useRepos.ts`

**Step 1: Create repos hook**

Create `src/hooks/useRepos.ts`:

```typescript
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface LocalRepo {
  name: string;
  path: string;
  current_branch: string;
  is_dirty: boolean;
}

export function useRepos() {
  const [repos, setRepos] = useState<LocalRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (roots: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LocalRepo[]>("scan_repos", {
        roots,
        maxDepth: 4,
      });
      setRepos(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { repos, loading, error, scan };
}
```

**Step 2: Build Repositories page**

Replace `src/pages/ReposPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useRepos, type LocalRepo } from "../hooks/useRepos";
import Database from "@tauri-apps/plugin-sql";

export function ReposPage() {
  const { repos, loading, error, scan } = useRepos();
  const [roots, setRoots] = useState<string[]>([]);
  const [newRoot, setNewRoot] = useState("");

  // Load saved scan roots from DB
  useEffect(() => {
    (async () => {
      const db = await Database.load("sqlite:aura.db");
      const rows = await db.select<{ path: string }[]>(
        "SELECT path FROM scan_roots"
      );
      const paths = rows.map((r) => r.path);
      setRoots(paths);
      if (paths.length > 0) {
        scan(paths);
      }
    })();
  }, [scan]);

  const addRoot = async () => {
    const trimmed = newRoot.trim();
    if (!trimmed || roots.includes(trimmed)) return;
    const db = await Database.load("sqlite:aura.db");
    await db.execute(
      "INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)",
      [crypto.randomUUID(), trimmed]
    );
    const updated = [...roots, trimmed];
    setRoots(updated);
    setNewRoot("");
    scan(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Repositories</h2>
        {roots.length > 0 && (
          <button
            onClick={() => scan(roots)}
            disabled={loading}
            className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>

      {roots.length === 0 && (
        <p className="text-zinc-400 mb-4">
          Add a directory to scan for local Git repositories.
        </p>
      )}

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newRoot}
          onChange={(e) => setNewRoot(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRoot()}
          placeholder="/Users/you/dev"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={addRoot}
          className="px-3 py-1.5 bg-zinc-800 text-sm rounded-md hover:bg-zinc-700 transition-colors"
        >
          Add
        </button>
      </div>

      {loading && <p className="text-zinc-500 animate-pulse">Scanning...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && repos.length > 0 && (
        <ul className="space-y-1">
          {repos.map((repo) => (
            <RepoRow key={repo.path} repo={repo} />
          ))}
        </ul>
      )}

      {!loading && repos.length === 0 && roots.length > 0 && (
        <p className="text-zinc-500">No Git repositories found in the configured directories.</p>
      )}
    </div>
  );
}

function RepoRow({ repo }: { repo: LocalRepo }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-zinc-900 transition-colors group">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-200">
          {repo.name}
          {repo.is_dirty && (
            <span className="ml-2 text-xs text-amber-500">modified</span>
          )}
        </p>
        <p className="text-xs text-zinc-500 truncate">{repo.path}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-zinc-500 font-mono">{repo.current_branch}</span>
      </div>
    </div>
  );
}
```

**Step 3: Verify**

```bash
pnpm tauri dev
```

Expected: Repos page shows an input to add scan directories. After adding a directory (e.g., `/Users/radaiko/dev`), repos are discovered and listed with branch names and dirty status.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Repositories view with local repo discovery"
```

---

## Task 10: Session Launching

**Files:**
- Create: `src-tauri/src/sessions.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/pages/ReposPage.tsx` (add launch buttons)

**Step 1: Create session launcher module**

Create `src-tauri/src/sessions.rs`:

```rust
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
        ("terminal", "Terminal", "open", vec!["-a", "Terminal", "."], "terminal"),
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
        return Err(format!("{} is not installed or not found on PATH", tool.name));
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
```

**Step 2: Register session commands**

Update `src-tauri/src/lib.rs`:

```rust
mod auth;
mod github;
mod repos;
mod sessions;

// ... in invoke_handler:
.invoke_handler(tauri::generate_handler![
    auth::check_github_auth,
    auth::get_github_token,
    github::github_fetch_issues,
    github::github_fetch_prs,
    github::github_fetch_user,
    repos::scan_repos,
    sessions::detect_session_tools,
    sessions::launch_session,
])
```

**Step 3: Add launch buttons to RepoRow**

Update the `RepoRow` component in `src/pages/ReposPage.tsx` to add session launch buttons. Add imports and state:

```tsx
import { invoke } from "@tauri-apps/api/core";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}
```

Add a `tools` state at the top of `ReposPage` and load them:

```tsx
const [tools, setTools] = useState<SessionTool[]>([]);

useEffect(() => {
  invoke<SessionTool[]>("detect_session_tools").then(setTools);
}, []);
```

Pass `tools` to `RepoRow` and add launch functionality:

```tsx
function RepoRow({ repo, tools }: { repo: LocalRepo; tools: SessionTool[] }) {
  const availableTools = tools.filter((t) => t.available);

  const launch = async (toolId: string) => {
    try {
      await invoke("launch_session", { toolId, repoPath: repo.path });
    } catch (err) {
      console.error("Failed to launch:", err);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-zinc-900 transition-colors group">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-200">
          {repo.name}
          {repo.is_dirty && (
            <span className="ml-2 text-xs text-amber-500">modified</span>
          )}
        </p>
        <p className="text-xs text-zinc-500 truncate">{repo.path}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {availableTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => launch(tool.id)}
            title={tool.name}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            {tool.name}
          </button>
        ))}
      </div>
      <span className="text-xs text-zinc-500 font-mono ml-3">{repo.current_branch}</span>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
cd src-tauri && cargo test && cd ..
```

Expected: All tests pass.

**Step 5: Verify**

```bash
pnpm tauri dev
```

Expected: Hovering over a repo row reveals launch buttons (VS Code, Terminal, any detected AI tools). Clicking "VS Code" opens VS Code in that repo's directory.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add session launching (VS Code, Terminal, AI coding tools)"
```

---

## Task 11: Settings Page

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: Build Settings page with connection status and scan root management**

Replace `src/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useGitHubAuth } from "../hooks/useGitHub";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

export function SettingsPage() {
  const { status, loading, refresh } = useGitHubAuth();
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [roots, setRoots] = useState<{ id: string; path: string }[]>([]);
  const [newRoot, setNewRoot] = useState("");

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools);
    loadRoots();
  }, []);

  const loadRoots = async () => {
    const db = await Database.load("sqlite:aura.db");
    const rows = await db.select<{ id: string; path: string }[]>(
      "SELECT id, path FROM scan_roots ORDER BY path"
    );
    setRoots(rows);
  };

  const addRoot = async () => {
    const trimmed = newRoot.trim();
    if (!trimmed) return;
    const db = await Database.load("sqlite:aura.db");
    await db.execute(
      "INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)",
      [crypto.randomUUID(), trimmed]
    );
    setNewRoot("");
    loadRoots();
  };

  const removeRoot = async (id: string) => {
    const db = await Database.load("sqlite:aura.db");
    await db.execute("DELETE FROM scan_roots WHERE id = ?", [id]);
    loadRoots();
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* GitHub Connection */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          GitHub Connection
        </h3>
        <div className="bg-zinc-900 rounded-lg p-4">
          {loading ? (
            <p className="text-zinc-500 animate-pulse">Checking...</p>
          ) : status ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Auth method</span>
                <span className="text-sm text-zinc-400">{status.auth_method}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">CLI installed</span>
                <span className={`text-sm ${status.cli_available ? "text-green-400" : "text-red-400"}`}>
                  {status.cli_available ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Authenticated</span>
                <span className={`text-sm ${status.cli_authenticated ? "text-green-400" : "text-red-400"}`}>
                  {status.cli_authenticated ? "Yes" : "No"}
                </span>
              </div>
              {status.username && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Username</span>
                  <span className="text-sm text-zinc-300">@{status.username}</span>
                </div>
              )}
              <button
                onClick={refresh}
                className="mt-2 text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Re-check
              </button>
            </div>
          ) : (
            <p className="text-red-400 text-sm">Unable to check auth status</p>
          )}
        </div>
      </section>

      {/* Scan Directories */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Repository Scan Directories
        </h3>
        <div className="space-y-2 mb-3">
          {roots.map((root) => (
            <div
              key={root.id}
              className="flex items-center justify-between bg-zinc-900 rounded-md px-3 py-2"
            >
              <span className="text-sm text-zinc-300 font-mono">{root.path}</span>
              <button
                onClick={() => removeRoot(root.id)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRoot()}
            placeholder="/Users/you/dev"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={addRoot}
            className="px-3 py-1.5 bg-zinc-800 text-sm rounded-md hover:bg-zinc-700 transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {/* Detected Tools */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Detected Tools
        </h3>
        <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
          {tools.map((tool) => (
            <div key={tool.id} className="flex items-center justify-between">
              <span className="text-sm">{tool.name}</span>
              <span
                className={`text-xs ${
                  tool.available ? "text-green-400" : "text-zinc-600"
                }`}
              >
                {tool.available ? "Available" : "Not found"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Verify**

```bash
pnpm tauri dev
```

Expected: Settings page shows GitHub auth status, scan directory management, and detected tools.

**Step 3: Run all tests**

```bash
pnpm test && cd src-tauri && cargo test && cd ..
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Settings page with auth status, scan roots, and tool detection"
```

---

## Task 12: Final Verification & Cleanup

**Step 1: Delete stale files**

```bash
rm -f firebase-debug.log
```

Remove any unused scaffold files (e.g., `src/assets/react.svg`, default Tauri greet template files).

**Step 2: Add CLAUDE.md**

Create `CLAUDE.md` at the repo root with project conventions:

```markdown
# Aura

Unified developer workspace — Tauri v2 + React + TypeScript.

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

## Project Structure

- `src/` — React frontend (TypeScript, Tailwind CSS v4)
- `src-tauri/` — Rust backend (Tauri v2)
- `docs/` — Requirements and plans

## Testing

```bash
pnpm test              # Frontend (vitest)
cd src-tauri && cargo test  # Backend (cargo)
```

## Architecture

Aura is an orchestration layer over existing dev tools:
- **GitHub CLI (`gh`)** — primary auth for GitHub
- **Graft web API** — repo discovery, worktrees, stacked branches (Phase 2)
- **Azure CLI (`az`)** — primary auth for Azure DevOps (Phase 2)

See `docs/requirements.md` for full PRD.
```

**Step 3: Full verification**

```bash
pnpm test
cd src-tauri && cargo test && cd ..
pnpm tauri build --debug
```

Expected: All tests pass, debug build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: cleanup scaffold artifacts, add CLAUDE.md"
```

---

## Phase 1 Exit Criteria Checklist

- [ ] Tauri v2 app launches with React frontend
- [ ] GitHub CLI auth detection works (shows auth status in Settings)
- [ ] Issues view loads assigned GitHub issues on-demand
- [ ] Pull Requests view loads authored/review-requested PRs
- [ ] Repositories view discovers local repos from configured directories
- [ ] Session launching works (VS Code, Terminal, detected AI tools)
- [ ] Settings page manages connections and scan directories
- [ ] SQLite database persists scan roots
- [ ] All Rust and frontend tests pass
- [ ] Debug build succeeds
