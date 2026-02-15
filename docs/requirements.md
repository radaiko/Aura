# Aura -- Product Requirements Document

| Field             | Value                          |
|-------------------|--------------------------------|
| **Document ID**   | AURA-PRD-001                   |
| **Version**       | 0.1.0 (Draft)                  |
| **Status**        | Draft -- Pending Review        |
| **Created**       | 2026-02-14                     |
| **Last Updated**  | 2026-02-14 (rev 1)             |
| **Author**        | Principal Product Architect    |

---

## Table of Contents

1. [Project Vision and Overview](#1-project-vision-and-overview)
2. [Requirements Audit](#2-requirements-audit)
3. [Functional Requirements -- Issue and Ticket Management](#3-functional-requirements----issue-and-ticket-management)
4. [Functional Requirements -- Repository Management](#4-functional-requirements----repository-management)
5. [Functional Requirements -- Development Sessions](#5-functional-requirements----development-sessions)
6. [Functional Requirements -- Dashboard and Visualization](#6-functional-requirements----dashboard-and-visualization)
7. [Integration Specifications](#7-integration-specifications)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Architecture Considerations](#9-architecture-considerations)
10. [Risk Register](#10-risk-register)
11. [Implementation Phasing](#11-implementation-phasing)
12. [Glossary](#12-glossary)
13. [Open Questions](#13-open-questions)

---

## 1. Project Vision and Overview

### 1.1 Vision Statement

Aura is a unified developer workspace that consolidates issue tracking, repository management, and development session orchestration into a single interface. It bridges the gap between fragmented toolchains (GitHub, Jira, FogBugz, Azure DevOps) and the local development environment, giving developers a single pane of glass for their daily workflow.

### 1.2 Strategic Rationale

Modern developers operate across multiple issue trackers, repository hosts, and IDEs. Context-switching between these systems is a measurable productivity drain. Aura addresses this by:

- Aggregating assigned issues from heterogeneous ticket systems into one view.
- Providing direct navigation from issues to repositories, branches, and pull requests.
- Enabling one-click launch of development sessions in the developer's preferred editor or terminal.
- Automating repository hygiene tasks (post-merge cleanup, worktree management).
- Integrating with Graft (via its web API) for stacked branch workflows.
- Leveraging existing developer CLI authentication (GitHub CLI, Azure CLI) to eliminate manual token management and reduce onboarding friction. Aura is an orchestration layer over tools developers already have installed and authenticated.

### 1.3 Target User

Individual developers and small engineering teams who work across multiple issue trackers and repository hosts simultaneously. The primary persona is a developer who has repositories from both GitHub and Azure DevOps, with tickets in two or more tracking systems.

### 1.4 Technology Context

- **Application Shell**: Aura is a **Tauri** desktop application with a web frontend (HTML/CSS/JS rendered in a system webview, with a Rust backend for OS-level operations).
- **Graft Integration**: Aura integrates with [Graft](https://github.com/radaiko/graft), a C#/.NET tool with a Svelte/TypeScript web UI for stacked branches, worktrees, and multi-repo management. Graft exposes a **web API** that Aura consumes over HTTP. Graft already provides repository discovery, worktree management, and stacked branch tracking -- Aura MUST leverage these capabilities via Graft's web API rather than re-implement them.
- **GitHub CLI (`gh`)**: Aura uses the [GitHub CLI](https://cli.github.com/) as the primary authentication source for GitHub. Aura extracts OAuth tokens via `gh auth token` and makes direct HTTP API calls to the GitHub REST/GraphQL APIs. The GitHub CLI is an external dependency that the user installs and authenticates independently of Aura.
- **Azure CLI (`az`)**: Aura uses the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/) as the primary authentication source for Azure DevOps. Aura extracts bearer tokens via `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798` and makes direct HTTP API calls to the Azure DevOps REST APIs. Azure CLI tokens are short-lived (~1 hour) and auto-refreshed by the CLI.
- **Architectural Pattern**: Aura is an **orchestration layer** over existing developer tools (Graft web API, GitHub CLI, Azure CLI). It delegates authentication and git operations to purpose-built tools rather than re-implementing them.

---

## 2. Requirements Audit

This section documents the interrogation of the raw requirements to surface assumptions, ambiguities, and gaps. Each item is categorized by severity.

### 2.1 Unstated Assumptions (Identified)

| ID       | Assumption                                                                                                          | Severity | Resolution                                                      |
|----------|---------------------------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------------|
| ASM-001  | Aura is a desktop application, not a CLI tool (since it emphasizes visual presentation and dashboards).              | High     | **Resolved.** Aura is a Tauri desktop application with a web frontend. |
| ASM-002  | "All my assigned topics" means issues/tickets/work items assigned to the authenticated user specifically.            | Medium   | Assumed correct. Clarify whether team-level views are needed.   |
| ASM-003  | "Topics" in FogBugz context means FogBugz Cases.                                                                    | Low      | Assumed correct. FogBugz terminology is "cases."                |
| ASM-004  | The application runs on the developer's local machine (not a shared server), since it accesses local repos.          | High     | **Confirmed.** Tauri desktop application runs locally.          |
| ASM-005  | ~~PATs are the sole authentication mechanism for GitHub and Azure DevOps (no OAuth flows initially).~~ **Superseded.** CLI-based auth (`gh auth token`, `az account get-access-token`) is the primary mechanism. PATs are a manual fallback for users without the CLIs installed. | Medium   | **Resolved.** Auth priority: (1) CLI-based token extraction (if CLI installed and authenticated), (2) PAT fallback (stored in OS Keychain). |
| ASM-006  | Graft runs as a local service exposing a web API. Aura communicates with Graft over HTTP, not via CLI subprocess.    | High     | **Resolved.** Graft exposes a web API; Aura consumes it over HTTP. |
| ASM-007  | "AI coding sessions" refers to specific AI-powered coding tools supported by Aura.                                   | High     | **Resolved.** Supported tools: Claude Code, GitHub CLI (gh copilot), Codex (OpenAI Codex CLI), OpenCode. |
| ASM-008  | Issue synchronization is not part of MVP. MVP is fully local with on-demand fetching only.                           | High     | **Resolved.** No sync in MVP. Issues are fetched on-demand. Sync (FR-002) is deferred to Phase 2. |
| ASM-009  | *(Removed -- Firebase has no role in the project.)* | -- | -- |
| ASM-010  | The user operates on macOS (based on project environment), but cross-platform support may be desired.                | Medium   | Validate. Graft supports Windows/macOS/Linux. Tauri supports all three platforms. |

### 2.2 Ambiguities (Requiring Resolution)

| ID       | Ambiguity                                                                                                             | Impact   | Proposed Resolution                                             |
|----------|-----------------------------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------------|
| AMB-001  | "Support synchronising issues" -- Sync direction? Frequency? Conflict resolution strategy?                            | Critical | **Resolved.** No sync in MVP. MVP is fully local -- issues are fetched on-demand only. Sync (FR-002) is deferred to Phase 2, where it will be pull-only (remote to local) with configurable polling. |
| AMB-002  | "Local linking of all ticket systems with repos, branches and PRs" -- What constitutes a "link"? Manual or automatic? | High     | Define as user-created associations stored locally, with auto-detection where branch names contain ticket IDs. |
| AMB-003  | "Create custom dashboards" -- What level of customization? Drag-and-drop widgets? Saved filters? Full layout control?  | High     | Define MVP as saved filter/group configurations. Full widget-based dashboards are Phase 2. |
| AMB-004  | "Search for all local repos" -- Search scope? Entire filesystem? Configurable root directories?                       | Medium   | Configurable root directories (not full filesystem scan). Graft already has repo discovery -- delegate to it. |
| AMB-005  | "Clean local repos after git squash merge" -- What does "clean" mean? Delete merged branches? Reset worktrees? Prune remotes? | High | Define as: delete local branches whose upstream has been squash-merged, prune stale remote tracking refs, and optionally remove associated worktrees. |
| AMB-006  | "Start AI coding sessions" -- What AI tooling? How is it configured? What is the session lifecycle?                   | High     | **Resolved.** Supported AI coding tools: Claude Code, GitHub CLI (gh copilot), Codex (OpenAI Codex CLI), OpenCode. Each is launched as an external process in the context of a selected repository. Tool availability is detected; selection is user-configurable. |
| AMB-007  | "Manual coding sessions in there with VSCode, VS2026, Terminal or others" -- What does "session" mean beyond opening an editor? State tracking? Time tracking? | Medium | Define as launching the editor/terminal at the repository path. Session state tracking is out of scope for MVP. |
| AMB-008  | "List assigned PRs" -- Assigned as reviewer, as author, or both?                                                      | Medium   | Both. Default view shows PRs where the user is author OR reviewer, with filters to separate them.             |

### 2.3 Missing Requirements (Discovered)

| ID       | Missing Requirement                                                                            | Severity |
|----------|------------------------------------------------------------------------------------------------|----------|
| MIS-001  | ~~No authentication/identity requirements specified. How does the user log in?~~ **Resolved.** Auth identity is derived from CLI tools: `gh auth status` identifies the GitHub user; `az account show` identifies the Azure DevOps user. For PAT fallback, identity is resolved via provider API calls (e.g., GitHub `GET /user`). Jira/FogBugz use their own token-based auth (see MIS-006). | Critical |
| MIS-002  | No data storage requirements. Where is local linking data persisted? SQLite? JSON?             | Critical |
| MIS-003  | No offline behavior specified. What works without network connectivity?                        | High     |
| MIS-004  | No notification/alerting requirements. Should the user be notified of new assignments?         | Medium   |
| MIS-005  | No error handling requirements for API failures (rate limiting, expired PATs, network errors).  | High     |
| MIS-006  | No requirements for Jira or FogBugz authentication method (API tokens, OAuth, basic auth). **Partially resolved.** Jira and FogBugz do NOT have equivalent CLIs for token extraction. Jira uses API Token (email + token) via Basic Auth or OAuth 2.0 (3LO) for Cloud. FogBugz uses its API token. These tokens are stored in OS Keychain per NFR-001. The CLI-based auth strategy applies only to GitHub (`gh`) and Azure DevOps (`az`). | High     |
| MIS-007  | ~~No requirements for how Graft integration works mechanically.~~ **Partially resolved.** Graft exposes a web API; Aura consumes it over HTTP. Detailed API contract (endpoints, request/response schemas) still needs documentation from Graft side. | High     |
| MIS-008  | No multi-account support specified. Can a user have two GitHub accounts? **Partially resolved.** CLI-based auth provides native multi-account support (`gh auth switch`, `az account set`). See OQ-004. | Medium   |
| MIS-009  | No data retention or cleanup policy for synced issues.                                         | Low      |
| MIS-010  | No accessibility requirements specified.                                                       | Medium   |

### 2.4 Contradiction Analysis

| ID       | Potential Conflict                                                                                                  | Resolution                                                       |
|----------|---------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| CON-001  | Graft already provides repo discovery, worktree management, and multi-repo status. Aura re-specifying these features risks duplication and divergence. | Aura SHOULD delegate to Graft for these capabilities via its web API and provide a UI layer on top, rather than re-implementing. |

---

## 3. Functional Requirements -- Issue and Ticket Management

### Domain: Issue Aggregation and Tracking

#### FR-001: Multi-Provider Issue Retrieval

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-001 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST retrieve and display issues/tickets/work items assigned to the authenticated user from GitHub Issues, Jira, FogBugz, and Azure DevOps Boards. |
| **Rationale**   | Core value proposition. Developers need a single view of all assigned work regardless of the source system. |
| **Dependencies** | FR-020 (Authentication & Connection Management) |
| **Constraints** | Each provider has different API rate limits, data models, and pagination schemes. Aura MUST normalize these into a unified internal model. |

**Acceptance Criteria:**

```
AC-001.1
Given the user has GitHub CLI (`gh`) installed and authenticated
When the user navigates to the Issues view
Then Aura extracts a token via `gh auth token`, makes direct HTTP API calls to
     GitHub, and displays all GitHub Issues assigned to the authenticated user
     across all accessible repositories within 5 seconds of initial load
     (for up to 500 issues)

AC-001.1a
Given the user does NOT have GitHub CLI installed but has configured a valid
     GitHub PAT with `repo` scope (fallback)
When the user navigates to the Issues view
Then all GitHub Issues assigned to the authenticated user across all accessible
     repositories are displayed within 5 seconds of initial load (for up to 500 issues)

AC-001.2
Given a user has configured valid Jira credentials
When the user navigates to the Issues view
Then all Jira issues assigned to the authenticated user (matching JQL:
     `assignee = currentUser() AND resolution = Unresolved`) are displayed

AC-001.3
Given a user has configured valid FogBugz credentials
When the user navigates to the Issues view
Then all FogBugz cases assigned to the authenticated user with status != "Closed"
     are displayed

AC-001.4
Given the user has Azure CLI (`az`) installed and authenticated
When the user navigates to the Issues view
Then Aura extracts a bearer token via
     `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798`,
     makes direct HTTP API calls to Azure DevOps, and displays all work items
     assigned to the authenticated user with state != "Closed" and state != "Removed"

AC-001.4a
Given the user does NOT have Azure CLI installed but has configured a valid
     Azure DevOps PAT (fallback)
When the user navigates to the Issues view
Then all Azure DevOps work items assigned to the authenticated user with state
     != "Closed" and state != "Removed" are displayed

AC-001.5
Given a user has configured connections to multiple providers
When the user navigates to the Issues view
Then issues from ALL configured providers are displayed in a single unified list,
     each tagged with its source provider
And the list loads within 8 seconds for up to 1000 total issues across all providers

AC-001.6
Given a provider API returns an error (401, 403, 429, 5xx, or network timeout)
When the user navigates to the Issues view
Then issues from all other healthy providers are still displayed
And the failing provider shows a clear error indicator with the error type
And the user is offered a "Retry" action for the failing provider

AC-001.7
Given the user has GitHub CLI installed but the CLI is not authenticated
     (i.e., `gh auth status` returns a non-zero exit code)
When the user navigates to the Issues view
Then Aura falls back to PAT-based auth if a PAT is configured
And if no PAT is configured, the GitHub provider shows an error:
     "GitHub authentication required. Run `gh auth login` or configure a PAT
     in Settings."
```

#### FR-002: Issue Synchronization

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-002 |
| **Priority**    | **P2 (Deferred -- NOT in MVP)** |
| **Statement**   | Aura MUST synchronize issues from configured providers to a local cache, supporting both on-demand and periodic background sync. |
| **Rationale**   | Enables offline access and reduces API calls. Provides responsive UI by reading from local cache. |
| **Dependencies** | FR-001, NFR-003 (Data Storage) |
| **Constraints** | Sync MUST be unidirectional (remote to local). Sync MUST NOT modify remote issues. |

> **MVP Note:** In the MVP, there is **no synchronization**. The application is fully local. Issues are fetched on-demand from provider APIs when the user navigates to the Issues view (see FR-001). There is no background sync, no local cache of issues, and no offline issue access. FR-002 is deferred to Phase 2.

**Acceptance Criteria (Phase 2):**

```
AC-002.1
Given the user triggers a manual sync (pull-to-refresh or sync button)
When the sync completes
Then the local issue cache reflects the current state of all remote providers
And a timestamp of the last successful sync per provider is displayed

AC-002.2
Given the user has configured a sync interval (default: 5 minutes, configurable: 1-60 minutes)
When the interval elapses
Then a background sync executes without blocking the UI
And the issue list updates in place without losing the user's scroll position or selection

AC-002.3
Given the network is unavailable
When the user opens the Issues view
Then the most recently cached issues are displayed
And a "Last synced: [timestamp]" indicator is shown
And a "Network unavailable" banner is displayed

AC-002.4
Given a remote issue has been updated since the last sync
When the next sync completes
Then the local cache reflects the updated fields (status, assignee, title, labels)
And the issue shows a visual indicator that it was recently updated (for 1 hour after sync)

AC-002.5
Given a remote issue has been deleted or unassigned from the user
When the next sync completes
Then the issue is removed from the local cache
```

#### FR-003: Issue-to-Development Artifact Linking

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-003 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST allow users to create and manage local links between any issue (from any provider) and local development artifacts: repositories, branches, and pull requests. |
| **Rationale**   | Cross-system traceability is the key integration value. A Jira ticket may relate to a GitHub PR and an Azure DevOps branch. |
| **Dependencies** | FR-001, FR-010 |
| **Constraints** | Links are stored locally. Links are user-created with optional auto-detection. |

**Acceptance Criteria:**

```
AC-003.1
Given the user is viewing an issue from any provider
When the user invokes the "Link Artifact" action
Then the user can search for and select:
     - A local repository (from the discovered repo list)
     - A branch within a repository
     - A pull request from GitHub or Azure DevOps
And the link is persisted locally and displayed on the issue detail view

AC-003.2
Given a local branch name contains a recognized ticket ID pattern
     (e.g., "feature/JIRA-1234-description" or "bugfix/AB#5678")
When the repository is scanned or the branch is created
Then Aura SHOULD auto-suggest a link between the branch and the matching issue
And the user can confirm or dismiss the suggestion

AC-003.3
Given an issue has one or more linked artifacts
When the user views the issue detail
Then all linked artifacts are displayed with:
     - Artifact type (repo, branch, PR)
     - Artifact name and status (for PRs: open/merged/closed)
     - A quick-action to open the artifact (navigate to repo, checkout branch, open PR in browser)

AC-003.4
Given the user wants to remove a link
When the user invokes "Unlink" on a linked artifact
Then the link is removed from local storage
And the remote issue and artifact are NOT modified
```

#### FR-004: Issue Unified Data Model

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-004 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST normalize issues from all providers into a unified internal data model that preserves provider-specific metadata while enabling cross-provider operations (filtering, sorting, searching). |
| **Rationale**   | Without normalization, the UI cannot present a coherent cross-provider experience. |
| **Dependencies** | FR-001 |
| **Constraints** | The normalized model MUST NOT lose provider-specific data needed for linking back to the source. |

**Unified Issue Model (Minimum Fields):**

| Field              | Type       | Source Mapping                                                                                       |
|--------------------|------------|------------------------------------------------------------------------------------------------------|
| `id`               | String     | Internal unique ID (UUID)                                                                            |
| `provider`         | Enum       | `github`, `jira`, `fogbugz`, `azure_devops`                                                         |
| `provider_id`      | String     | Native ID in the source system                                                                       |
| `provider_url`     | URL        | Deep link back to the issue in the source system                                                     |
| `title`            | String     | GitHub: `title`, Jira: `summary`, FogBugz: `sTitle`, Azure DevOps: `System.Title`                   |
| `status`           | String     | Normalized to a common set: `open`, `in_progress`, `resolved`, `closed` with original value preserved |
| `priority`         | String     | Normalized with original value preserved                                                              |
| `assignee`         | String     | The authenticated user (confirmed by provider)                                                       |
| `labels`           | String[]   | Tags, labels, or categories from the source                                                          |
| `project`          | String     | GitHub: `repo.full_name`, Jira: `project.key`, FogBugz: `sProject`, Azure DevOps: `System.TeamProject` |
| `created_at`       | DateTime   | Source creation timestamp (UTC)                                                                      |
| `updated_at`       | DateTime   | Source last-updated timestamp (UTC)                                                                  |
| `synced_at`        | DateTime   | Last successful sync timestamp (UTC)                                                                 |
| `linked_artifacts` | Artifact[] | Locally managed links (see FR-003)                                                                   |

**Acceptance Criteria:**

```
AC-004.1
Given issues exist from multiple providers
When the user applies a filter (e.g., status = "open")
Then the filter operates correctly across all providers using the normalized status field

AC-004.2
Given an issue has a normalized status
When the user views the issue detail
Then both the normalized status AND the original provider-specific status are visible

AC-004.3
Given the user sorts the unified issue list by "updated_at"
When issues from multiple providers are present
Then sorting is chronologically correct across providers using UTC timestamps
```

---

## 4. Functional Requirements -- Repository Management

### Domain: Local Repository Discovery and Management

#### FR-010: Local Repository Discovery

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-010 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST discover and present all Git repositories within user-configured root directories. Aura SHOULD delegate repository discovery to Graft via its web API if Graft is running, and fall back to its own filesystem scanning if Graft's web API is not reachable. |
| **Rationale**   | Graft already implements repository discovery with multi-directory support and status reporting. Duplicating this logic introduces maintenance burden and divergence risk. |
| **Dependencies** | FR-017 (Graft Integration) |
| **Constraints** | Discovery MUST be bounded to configured directories (no full filesystem scan). Scanning MUST be non-blocking. |

**Acceptance Criteria:**

```
AC-010.1
Given the user has configured one or more root directories for repository scanning
When the user opens the Repository view
Then all Git repositories found within those directories (recursively, up to a
     configurable depth, default: 4 levels) are listed
And each repository displays: name, path, current branch, and clean/dirty status

AC-010.2
Given Graft's web API is reachable on localhost
When Aura performs repository discovery
Then Aura delegates to Graft's repository discovery API endpoint
And the results include Graft-specific metadata (stacks, worktrees)

AC-010.3
Given Graft's web API is NOT reachable (not running or connection refused)
When Aura performs repository discovery
Then Aura performs its own filesystem scan for `.git` directories
And a notice is displayed suggesting the user start Graft for enhanced functionality

AC-010.4
Given a root directory contains more than 200 repositories
When the discovery completes
Then all repositories are listed
And the discovery completes within 10 seconds
And results are streamed to the UI progressively (not blocked until full completion)

AC-010.5
Given the user adds or removes a root directory in settings
When the configuration is saved
Then the repository list is refreshed to reflect the change within 3 seconds
```

#### FR-011: Remote Repository Cloning

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-011 |
| **Priority**    | P1 (Should Have) |
| **Statement**   | Aura MUST support cloning new repositories from GitHub and Azure DevOps using the active authentication method (CLI-based token or PAT fallback). The user MUST be able to browse and search remote repositories before cloning. |
| **Rationale**   | Onboarding to a new project often starts with cloning. Integrating this into Aura avoids context-switching to a browser. |
| **Dependencies** | FR-020 (Authentication) |
| **Constraints** | Clone target directory MUST be within a configured root directory. |

**Acceptance Criteria:**

```
AC-011.1
Given the user has valid GitHub authentication (via `gh` CLI or PAT fallback)
When the user invokes "Clone Repository" and selects the GitHub provider
Then the user can search GitHub repositories by name (the user's repos and
     organization repos accessible via the authenticated identity)
And select a target directory within a configured root
And initiate the clone operation with a progress indicator

AC-011.2
Given the user has valid Azure DevOps authentication (via `az` CLI or PAT fallback)
When the user invokes "Clone Repository" and selects the Azure DevOps provider
Then the user can browse Azure DevOps projects and repositories
And select a target directory and initiate the clone

AC-011.3
Given a clone operation is in progress
When the clone completes successfully
Then the new repository appears in the Repository view immediately
And a success notification is displayed

AC-011.4
Given a clone operation fails (network error, auth error, disk space)
When the error occurs
Then a clear error message is displayed indicating the cause
And any partial clone directory is cleaned up
```

#### FR-012: Post-Squash-Merge Branch Cleanup

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-012 |
| **Priority**    | P1 (Should Have) |
| **Statement**   | Aura MUST provide an automated cleanup operation for local repositories after a squash merge has been completed on the remote. Aura MUST delegate cleanup operations to **Graft via its web API**. The cleanup MUST: (a) identify local branches whose upstream counterpart has been squash-merged, (b) delete those local branches, (c) prune stale remote-tracking references, and (d) optionally remove associated worktrees. |
| **Rationale**   | Squash merges leave orphaned local branches that `git branch --merged` cannot detect (because the squash commit has a different SHA). This is a persistent pain point. Graft already has the logic for repository cleanup -- Aura provides the UI trigger and delegates execution to Graft's web API. |
| **Dependencies** | FR-010, FR-017 (Graft Integration) |
| **Constraints** | The operation MUST NOT delete branches with uncommitted or unpushed changes unless the user explicitly confirms. Requires Graft to be running and its web API to be reachable. |

**Acceptance Criteria:**

```
AC-012.1
Given a local branch "feature/xyz" was squash-merged into "main" on the remote
When the user runs the cleanup operation on the repository
Then Aura delegates to Graft's web API to identify "feature/xyz" as squash-merged
And presents the results to the user for confirmation before deletion

AC-012.2
Given a branch identified for cleanup has unpushed local commits
When the cleanup operation runs
Then that branch is flagged with a warning: "Has unpushed commits"
And it is NOT auto-selected for deletion (user must explicitly opt in)

AC-012.3
Given a branch identified for cleanup has an associated worktree
When the user confirms deletion of that branch
Then the associated worktree is also removed (with confirmation)
And the worktree directory is cleaned up from the filesystem

AC-012.4
Given the user selects "Clean All Repos" from the Repository view
When the operation runs
Then the cleanup executes across all discovered repositories
And a summary report is displayed: [N] branches deleted, [M] remotes pruned,
     [K] worktrees removed, [J] branches skipped (with reasons)
```

#### FR-013: Git Worktree Management

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-013 |
| **Priority**    | P1 (Should Have) |
| **Statement**   | Aura MUST provide a UI for creating, listing, and removing Git worktrees. When Graft's web API is reachable, Aura SHOULD delegate worktree operations to Graft to ensure consistent naming conventions and metadata tracking. |
| **Rationale**   | Worktrees enable parallel development on multiple branches without stashing. Graft already manages worktrees with conventions -- Aura should present a UI layer over Graft's web API capabilities. |
| **Dependencies** | FR-010, FR-017 (Graft Integration) |
| **Constraints** | Worktree paths MUST follow a consistent, configurable naming convention. |

**Acceptance Criteria:**

```
AC-013.1
Given the user selects a repository in the Repository view
When the user invokes "Manage Worktrees"
Then all existing worktrees for that repository are listed with:
     branch name, path, and status (clean/dirty)

AC-013.2
Given the user invokes "Create Worktree"
When the user specifies a branch name (existing or new)
Then a worktree is created following the configured naming convention
And the new worktree appears in the worktree list immediately

AC-013.3
Given the user invokes "Remove Worktree" on an existing worktree
When the worktree has no uncommitted changes
Then the worktree is removed from git and the directory is deleted

AC-013.4
Given the user invokes "Remove Worktree" on a worktree with uncommitted changes
When the confirmation dialog is shown
Then the dialog warns about uncommitted changes
And the user must explicitly confirm forced removal
```

#### FR-014: Stacked Branch Management via Graft

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-014 |
| **Priority**    | P1 (Should Have) |
| **Statement**   | Aura MUST integrate with Graft via its web API to provide stacked branch visualization and management. This includes viewing branch dependency graphs, triggering bottom-to-top merges, and committing to specific branches within a stack. |
| **Rationale**   | Stacked branches are a core workflow for the target user. Graft provides the engine (via web API); Aura provides the unified dashboard experience. |
| **Dependencies** | FR-017 (Graft Integration -- required) |
| **Constraints** | This feature is ONLY available when Graft's web API is reachable. Aura MUST NOT re-implement stacked branch logic. |

**Acceptance Criteria:**

```
AC-014.1
Given Graft's web API is reachable and the selected repository has defined stacks
When the user views the repository detail
Then the branch stack is visualized as a dependency graph (parent-child relationships)

AC-014.2
Given the user selects a stack in the repository detail view
When the user invokes "Merge Stack" (bottom-to-top)
Then the merge operation is executed via Graft's web API
And progress and results are displayed in the Aura UI

AC-014.3
Given Graft's web API is NOT reachable
When the user navigates to a repository's stack view
Then a message is displayed: "Stacked branch management requires Graft to be running.
     Start Graft or install from: https://github.com/radaiko/graft"
And no stack-related operations are available
```

#### FR-015: Pull Request Aggregation

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-015 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST retrieve and display pull requests from GitHub and Azure DevOps where the authenticated user is either the author or a requested reviewer. |
| **Rationale**   | PR review is a daily activity. Aggregating PRs across providers alongside issues creates a complete work queue. |
| **Dependencies** | FR-020 (Authentication) |
| **Constraints** | FogBugz and Jira do not have native PR concepts (Jira links to Bitbucket/GitHub via integrations, which is out of scope for MVP). |

**Acceptance Criteria:**

```
AC-015.1
Given the user has valid GitHub authentication (via `gh` CLI or PAT fallback)
When the user navigates to the Pull Requests view
Then all open PRs where the user is author OR requested reviewer are displayed
And each PR shows: title, repository, author, review status, CI status, and age

AC-015.2
Given the user has valid Azure DevOps authentication (via `az` CLI or PAT fallback)
When the user navigates to the Pull Requests view
Then all active PRs where the user is author or required reviewer are displayed

AC-015.3
Given the user views a PR in the aggregated list
When the user clicks the PR
Then the PR opens in the source provider's web interface (browser)

AC-015.4
Given PRs exist from both GitHub and Azure DevOps
When the user views the Pull Requests list
Then PRs from both providers are displayed in a single list, sortable by
     updated date, provider, repository, or review status
```

---

## 5. Functional Requirements -- Development Sessions

### Domain: Editor and Tool Integration

#### FR-016: Development Session Launching

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-016 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST allow the user to launch a development session in a selected repository using a configurable set of editors and tools. Supported session targets MUST include at minimum: Visual Studio Code, Visual Studio 2026, a system terminal, and a configurable custom command. AI-assisted session targets MUST support the following tools: **Claude Code**, **GitHub CLI** (`gh copilot`), **Codex** (OpenAI Codex CLI), and **OpenCode**. |
| **Rationale**   | The transition from "I see my assigned issue" to "I am writing code" should be one click. |
| **Dependencies** | FR-010 |
| **Constraints** | Aura launches external processes via Tauri's shell/command API. It does NOT embed an editor. Session launch MUST work on macOS. Windows and Linux support is tracked separately (see ASM-010). |

**Acceptance Criteria:**

```
AC-016.1
Given the user selects a repository in the Repository view
When the user invokes "Open in VSCode"
Then Visual Studio Code opens with the repository root as the workspace folder
And if the repository has a `.code-workspace` file, that workspace is opened instead

AC-016.2
Given the user selects a repository
When the user invokes "Open in Terminal"
Then the system's default terminal opens with the working directory set to the repository root

AC-016.3
Given the user selects a repository
When the user invokes "Open in Visual Studio 2026"
Then Visual Studio 2026 opens with the repository's solution file (.sln) if one exists,
     or the repository root directory if no solution file is found

AC-016.4
Given the user selects an AI coding tool session (Claude Code, GitHub CLI, Codex, or OpenCode)
When the user invokes the AI session
Then the selected AI tool is launched as an external process with the repository root
     as the working directory
And the following tools are supported out of the box:
     - Claude Code: `claude` command
     - GitHub CLI: `gh copilot` command
     - Codex: `codex` command (OpenAI Codex CLI)
     - OpenCode: `opencode` command
And additional custom commands (e.g., "nvim", "cursor .") MAY be configured in Settings

AC-016.5
Given the configured editor/tool is not installed or not found on PATH
When the user invokes a session
Then an error message is displayed: "[Tool name] was not found. Please verify
     the installation path in Settings."
And no process is launched

AC-016.6
Given the user selects a specific worktree (not the main working directory)
When the user invokes any session type
Then the session opens in the worktree's directory, not the main repository directory
```

---

## 6. Functional Requirements -- Dashboard and Visualization

### Domain: Custom Dashboards

#### FR-018: Custom Dashboard Creation

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-018 |
| **Priority**    | P2 (Nice to Have for MVP, required for v1) |
| **Statement**   | Aura MUST allow users to create, save, and manage custom dashboards that aggregate data from issues, repositories, and pull requests using configurable filters and groupings. |
| **Rationale**   | Different developers have different workflows. A backend developer may want to see PRs and Jira tickets grouped by sprint; a DevOps engineer may want repos grouped by CI status. |
| **Dependencies** | FR-001, FR-010, FR-015 |
| **Constraints** | MVP dashboards are filter/group configurations. Full drag-and-drop widget layout is deferred. |

**Acceptance Criteria:**

```
AC-018.1
Given the user is on the Dashboard view
When the user invokes "Create Dashboard"
Then a dashboard configuration form is presented allowing:
     - Name (required, 1-100 characters)
     - Data source selection: Issues, Repositories, Pull Requests (multi-select)
     - Filter criteria per data source (provider, status, label, project)
     - Grouping: by provider, by project, by status, by priority
     - Sort order

AC-018.2
Given the user saves a dashboard configuration
When the user navigates to the Dashboard view
Then the saved dashboard appears in the dashboard list
And selecting it displays the configured data with the specified filters and groupings

AC-018.3
Given the user has created multiple dashboards
When the user opens Aura
Then the last-viewed dashboard is displayed by default

AC-018.4
Given the user edits a saved dashboard's configuration
When the user saves changes
Then the dashboard immediately reflects the updated configuration
And no data loss occurs (existing dashboard data is refreshed, not cleared)

AC-018.5
Given the user deletes a dashboard
When the deletion is confirmed
Then the dashboard is removed from the list
And if it was the last-viewed dashboard, the next dashboard in the list becomes default
```

---

## 7. Integration Specifications

### 7.1 Graft Integration

| Field           | Value |
|-----------------|-------|
| **ID**          | FR-017 |
| **Priority**    | P1 (Should Have) |

| Aspect                | Specification |
|-----------------------|---------------|
| **Detection**         | Aura MUST check for Graft availability by making an HTTP health-check request to Graft's web API on startup (e.g., `GET /api/health` or equivalent). The result MUST be cached for the session duration, with periodic re-checks (configurable, default: every 60 seconds). |
| **Invocation Method** | **HTTP web API.** Aura communicates with Graft's web API over HTTP (localhost). Aura MUST NOT bundle or embed Graft. Aura MUST NOT invoke Graft as a CLI subprocess. |
| **Data Exchange**     | Aura sends HTTP requests to Graft's web API and receives JSON responses. The Graft API base URL MUST be configurable (default: `http://localhost:{port}`, where port is Graft's default or user-configured). |
| **Features Delegated**| Repository discovery, worktree management, stacked branch operations, multi-repo status, post-squash-merge branch cleanup. |
| **Failure Handling**  | If Graft's web API is unreachable (connection refused, timeout, or error response), all Graft-dependent features MUST degrade gracefully with user-visible notices indicating that Graft is not running. Core features (issue tracking, basic repo listing, session launching) MUST NOT depend on Graft. |
| **Version Requirement**| Aura SHOULD query Graft's API version endpoint and warn if the API version is below the minimum supported version. |

### 7.2 GitHub Integration

| Aspect                | Specification |
|-----------------------|---------------|
| **Authentication**    | **Primary: GitHub CLI (`gh`).** Aura extracts an OAuth token by invoking `gh auth token` (subprocess call). The returned token is used directly in HTTP `Authorization: Bearer {token}` headers for GitHub REST/GraphQL API calls. Aura does NOT store this token -- it is extracted on-demand from the CLI each time it is needed. **Fallback: PAT.** If `gh` is not installed or not authenticated (`gh auth status` returns non-zero), Aura falls back to a manually configured Personal Access Token with `repo`, `read:org`, and `read:user` scopes, stored in OS Keychain per NFR-001. **Auth priority order:** (1) `gh auth token`, (2) PAT from Keychain. |
| **Health Check**      | On startup and periodically, Aura SHOULD run `gh auth status` to verify CLI authentication. If the CLI is authenticated, Aura displays the authenticated GitHub username and account type. |
| **Multi-Account**     | The GitHub CLI supports multiple accounts via `gh auth switch`. Aura SHOULD detect available accounts and allow the user to select which account to use, or use the CLI's currently active account by default. |
| **Scope Validation**  | When using CLI auth, scope validation is handled by the CLI's OAuth flow (the user authorized scopes during `gh auth login`). Aura SHOULD query `GET /user` and verify the response to confirm sufficient access. When using PAT fallback, Aura MUST validate scopes via the `X-OAuth-Scopes` response header and warn about missing scopes. |
| **API Version**       | GitHub REST API v3 (`api.github.com`). GraphQL API v4 MAY be used for optimized queries. Both CLI-extracted tokens and PATs are used identically in API calls. |
| **Rate Limiting**     | Aura MUST respect `X-RateLimit-Remaining` headers. When remaining < 100, reduce polling frequency. When remaining = 0, pause until `X-RateLimit-Reset`. |
| **Pagination**        | All list endpoints use Link header pagination. Aura MUST follow pagination to retrieve complete result sets. |
| **Data Retrieved**    | Issues (assigned), Pull Requests (authored/reviewing), Repositories (accessible), Branches. |
| **GitHub Enterprise** | Out of scope for MVP. Custom base URL support is a Phase 2 feature. When using `gh`, the CLI handles Enterprise routing automatically if the user has authenticated with a GHE instance. |

### 7.3 Jira Integration

| Aspect                | Specification |
|-----------------------|---------------|
| **Authentication**    | API Token (email + token) via Basic Auth header, OR OAuth 2.0 (3LO) for Jira Cloud. PAT for Jira Data Center. |
| **API Version**       | Jira REST API v3 (Cloud) or v2 (Data Center). |
| **Instance Config**   | User MUST configure the Jira instance base URL (e.g., `https://mycompany.atlassian.net`). |
| **Rate Limiting**     | Jira Cloud: respect `Retry-After` headers. Implement exponential backoff. |
| **Data Retrieved**    | Issues via JQL query: `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`. |
| **Field Mapping**     | See FR-004 unified model. Jira custom fields are out of scope for MVP. |

### 7.4 FogBugz Integration

| Aspect                | Specification |
|-----------------------|---------------|
| **Authentication**    | API Token obtained via `api.asp?cmd=logon` or pre-generated token. |
| **API Version**       | FogBugz XML API (or JSON API if available on the target instance). |
| **Instance Config**   | User MUST configure the FogBugz instance base URL. |
| **Rate Limiting**     | FogBugz does not publish rate limits. Aura SHOULD implement a conservative default (max 10 requests/second). |
| **Data Retrieved**    | Cases assigned to the authenticated user, not closed. Retrieved via `cmd=search` with `q=assignedTo:"me" status:"active"`. |
| **Limitations**       | FogBugz API capabilities vary significantly between versions. Aura MUST handle missing fields gracefully. |

### 7.5 Azure DevOps Integration

| Aspect                | Specification |
|-----------------------|---------------|
| **Authentication**    | **Primary: Azure CLI (`az`).** Aura extracts a bearer token by invoking `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798` (subprocess call). The resource GUID `499b84ac-1321-427f-aa17-267ca6975798` is the well-known resource identifier for Azure DevOps. The returned JSON contains an `accessToken` field used in HTTP `Authorization: Bearer {token}` headers. Azure CLI tokens are short-lived (~1 hour) and are auto-refreshed by the CLI transparently. Aura does NOT store these tokens -- they are extracted on-demand. **Fallback: PAT.** If `az` is not installed or not authenticated (`az account show` returns non-zero), Aura falls back to a manually configured Personal Access Token with scopes: `vso.work` (read work items), `vso.code` (read code), `vso.code_status` (read PR status), stored in OS Keychain per NFR-001. **Auth priority order:** (1) `az account get-access-token`, (2) PAT from Keychain. |
| **Health Check**      | On startup and periodically, Aura SHOULD run `az account show` to verify CLI authentication and identify the active subscription/tenant. If the CLI is authenticated, Aura displays the authenticated user identity and tenant. |
| **Multi-Account**     | The Azure CLI supports multiple subscriptions and tenants via `az account set`. Aura SHOULD detect available subscriptions and allow the user to select the appropriate context, or use the CLI's currently active subscription by default. |
| **Token Refresh**     | Azure CLI tokens expire after approximately 1 hour. Aura MUST handle token expiration gracefully by re-invoking `az account get-access-token` when a 401 response is received. This is transparent to the user since the CLI handles refresh internally. |
| **API Version**       | Azure DevOps REST API v7.x. Both CLI-extracted bearer tokens and PATs are used identically in API calls. |
| **Instance Config**   | User MUST configure the organization URL (e.g., `https://dev.azure.com/{org}`). When using Azure CLI auth, the organization is still user-configured (the CLI provides auth, not org routing). |
| **Rate Limiting**     | Respect `Retry-After` and `X-RateLimit-*` headers. Azure DevOps uses token bucket rate limiting. |
| **Pagination**        | Continuation token-based. Aura MUST follow `x-ms-continuationtoken` headers. |
| **Data Retrieved**    | Work Items (via WIQL: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] <> 'Closed'`), Pull Requests (authored/reviewing), Repositories, Branches. |

---

## 8. Non-Functional Requirements

### NFR-001: Security -- Credential Management

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-001 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | For GitHub and Azure DevOps, Aura MUST use CLI-based authentication as the primary mechanism: tokens are extracted on-demand from GitHub CLI (`gh auth token`) and Azure CLI (`az account get-access-token`) and are NOT stored by Aura. When CLI auth is active, no OS Keychain interaction is required for those providers. For the PAT fallback (GitHub, Azure DevOps) and for providers without CLI equivalents (Jira, FogBugz), Aura MUST store all authentication credentials (PATs, API tokens) using the operating system's secure credential storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). Credentials MUST NEVER be stored in plaintext files, environment variables written to disk, or application configuration files. CLI-extracted tokens MUST be held in memory only for the duration of the API call and MUST NOT be persisted to disk. |

**Acceptance Criteria:**

```
AC-NFR-001.1
Given the user is authenticated via GitHub CLI (`gh auth token`)
When Aura makes a GitHub API call
Then the token is extracted from the CLI on-demand, used for the HTTP request,
     and NOT written to any file, database, or OS credential store by Aura

AC-NFR-001.2
Given the user is authenticated via Azure CLI (`az account get-access-token`)
When Aura makes an Azure DevOps API call
Then the bearer token is extracted from the CLI on-demand, used for the HTTP
     request, and NOT written to any file, database, or OS credential store by Aura

AC-NFR-001.3
Given the user configures a PAT as a fallback for any provider (or a Jira/FogBugz
     API token, which always uses this path)
When the token is saved
Then it is stored in the OS-native credential store
And it is NOT present in any file within the Aura data directory

AC-NFR-001.4
Given an attacker gains read access to the Aura data directory
When they examine all files
Then no credential material (tokens, passwords, API keys) is recoverable

AC-NFR-001.5
Given the user deletes a provider connection that used PAT/token fallback
When the deletion completes
Then the associated credential is removed from the OS credential store

AC-NFR-001.6
Given the user deletes a provider connection that used CLI-based auth
When the deletion completes
Then no credential cleanup is needed (Aura never stored a credential for this
     connection) and the CLI's own auth state is NOT modified
```

### NFR-002: Performance

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-002 |
| **Priority**    | P1 (Should Have) |

| Metric                              | Target                              |
|--------------------------------------|-------------------------------------|
| Application cold start to interactive| < 3 seconds                        |
| Issue list render (from cache)       | < 500ms for 1000 issues            |
| Repository discovery (200 repos)     | < 10 seconds                       |
| Session launch (editor/terminal)     | < 2 seconds from click to editor visible |
| Background sync cycle                | < 30 seconds for 4 providers, 1000 total issues |
| UI responsiveness during sync        | No frame drops > 100ms             |

### NFR-003: Data Storage

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-003 |
| **Priority**    | P0 (Must Have) |
| **Statement**   | Aura MUST persist local data (issue cache, artifact links, dashboard configurations, user preferences) in a local database. SQLite is the RECOMMENDED storage engine for its reliability, zero-configuration nature, and cross-platform support. |

**Acceptance Criteria:**

```
AC-NFR-003.1
Given the user closes and reopens Aura
When the application starts
Then all previously cached issues, links, and dashboard configurations are available
     without requiring a network sync

AC-NFR-003.2
Given the local database file is corrupted or deleted
When Aura starts
Then it detects the issue, creates a fresh database, and triggers a full sync
And the user is notified that local data was reset
```

### NFR-004: Availability and Offline Behavior

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-004 |
| **Priority**    | P1 (Should Have) |
| **Statement**   | Aura MUST function in a degraded mode when network connectivity is unavailable. All locally cached data MUST remain accessible. Operations requiring network (sync, clone, PR fetch) MUST fail gracefully with clear messaging. |

### NFR-005: Observability and Logging

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-005 |
| **Priority**    | P2 (Nice to Have) |
| **Statement**   | Aura SHOULD log API interactions, sync operations, and errors to a local log file for debugging. Log level SHOULD be configurable (debug, info, warn, error). Logs MUST NOT contain credential material. |

### NFR-006: Accessibility

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-006 |
| **Priority**    | P2 (Nice to Have) |
| **Statement**   | Aura SHOULD meet WCAG 2.1 Level AA accessibility standards for all interactive elements, including keyboard navigation, screen reader compatibility, and sufficient color contrast. |

### NFR-007: Extensibility

| Field           | Value |
|-----------------|-------|
| **ID**          | NFR-007 |
| **Priority**    | P2 (Nice to Have) |
| **Statement**   | Aura's provider integration layer SHOULD be designed as a plugin architecture, allowing future addition of new issue trackers (e.g., Linear, Shortcut, YouTrack) and repository hosts (e.g., GitLab, Bitbucket) without modifying core application logic. |

---

## 9. Architecture Considerations

### 9.1 High-Level Architecture

```
+======================================================================+
|                        TAURI APPLICATION                              |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  |                   WEB FRONTEND (Webview)                        |  |
|  |  (Dashboard | Issues | Repositories | Pull Requests | Settings)|  |
|  +----------------------------------------------------------------+  |
|           |                    |                    |                 |
|           v                    v                    v                 |
|  +----------------------------------------------------------------+  |
|  |                   TAURI BACKEND (Rust)                          |  |
|  |  +------------------+ +------------------+ +------------------+ | |
|  |  |  Issue Service   | |  Repo Service    | | Session Service  | | |
|  |  |  (Aggregation,   | |  (Discovery,     | | (Editor Launch,  | | |
|  |  |   Fetch, Link)   | |   Clone, Clean)  | |  Tool Config)    | | |
|  |  +------------------+ +------------------+ +------------------+ | |
|  |           |                    |                    |            | |
|  |           v                    v                    v            | |
|  |  +--------------------------------------------------------------+|
|  |  |               Auth Resolution Layer                          ||
|  |  |  [CLI token extraction (gh/az) -> PAT fallback (Keychain)]   ||
|  |  +--------------------------------------------------------------+|
|  |           |                    |                    |            | |
|  |           v                    v                    v            | |
|  |  +--------------------------------------------------------------+|
|  |  |                 Provider Adapter Layer                        ||
|  |  | +----------+ +-------+ +---------+ +-------------+           ||
|  |  | | GitHub   | | Jira  | | FogBugz | | Azure DevOps|           ||
|  |  | | Adapter  | |Adapter| | Adapter | | Adapter     |           ||
|  |  | +----------+ +-------+ +---------+ +-------------+           ||
|  |  +--------------------------------------------------------------+|
|  +----------------------------------------------------------------+  |
|           |                                                          |
|           v                                                          |
|  +------------------+                    +------------------+        |
|  | Credential Store |                    |  Local Database  |        |
|  | (OS Keychain)    |                    |  (SQLite)        |        |
|  | [PAT fallback &  |                    +------------------+        |
|  |  Jira/FogBugz    |                                                |
|  |  tokens only]    |                                                |
|  +------------------+                                                |
+======================================================================+
           |                         |                        |
           v  (HTTP)                 v  (subprocess)          v  (subprocess)
+------------------+      +------------------+      +------------------+
| Graft Web API    |      | GitHub CLI (gh)  |      | Azure CLI (az)   |
| (localhost)      |      | [Token Source:   |      | [Token Source:   |
| [Repo Discovery, |      |  gh auth token]  |      |  az account      |
|  Worktrees,      |      | [Health Check:   |      |  get-access-     |
|  Stacked Branches|      |  gh auth status] |      |  token]          |
|  Branch Cleanup] |      | [Multi-Account:  |      | [Health Check:   |
+------------------+      |  gh auth switch] |      |  az account show]|
                           +------------------+      +------------------+
```

### 9.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Application Shell** | **Tauri** desktop application with web frontend | Tauri provides a lightweight, cross-platform desktop shell with a Rust backend for OS-level operations (file system, process spawning, credential access) and a system webview for the UI. Smaller binary size and lower memory footprint than Electron. |
| **Provider Abstraction** | Adapter pattern with a common `IProvider` interface per domain (issues, repos, PRs) | Enables adding providers without modifying consumers. Each adapter normalizes provider-specific data into the unified model. |
| **Data Persistence** | SQLite for local data, OS Keychain for credentials (PAT fallback only) | SQLite is embeddable, requires no server, handles concurrent reads well, and is proven for desktop apps. Keychain protects PAT/token secrets for fallback auth and Jira/FogBugz. CLI-based auth requires no Keychain. |
| **Authentication Strategy** | **CLI-first with PAT fallback.** GitHub CLI (`gh auth token`) and Azure CLI (`az account get-access-token`) are the primary auth sources. PATs are a manual fallback. Jira/FogBugz use their own token-based auth (no CLI equivalent). | Eliminates PAT management burden for most users. Leverages existing developer authentication -- zero onboarding friction. Azure CLI tokens are short-lived (~1 hour, auto-refreshed), improving security posture. CLI OAuth flows handle scope validation, removing user guesswork about PAT scopes. Consistent architectural pattern: Aura orchestrates existing tools (`gh`, `az`, Graft) rather than re-implementing their concerns. |
| **Graft Integration** | **HTTP web API**, not CLI subprocess or library embedding | Graft exposes a web API on localhost. Aura communicates with Graft over HTTP, keeping the two systems loosely coupled while enabling rich structured data exchange (JSON). This avoids CLI output parsing fragility. |
| **Sync Strategy (Phase 2)** | Poll-based with configurable intervals (deferred from MVP) | Push-based (webhooks) requires a publicly reachable endpoint, which is inappropriate for a local desktop tool. Polling is simpler and works offline-first. MVP uses on-demand fetching only. |

### 9.3 Domain Model Boundaries

| Bounded Context           | Aggregates                      | Key Events                                           |
|---------------------------|---------------------------------|------------------------------------------------------|
| Issue Management          | Issue, ArtifactLink             | IssueSynced, IssueLinkCreated, IssueLinkRemoved      |
| Repository Management     | Repository, Worktree, Branch    | RepoDiscovered, RepoCloned, BranchCleaned            |
| Pull Request Management   | PullRequest                     | PRSynced, PRStatusChanged                            |
| Session Management        | SessionConfig                   | SessionLaunched                                      |
| Dashboard                 | Dashboard, DashboardFilter      | DashboardCreated, DashboardUpdated                   |
| Provider Connectivity     | ProviderConnection, Credential  | ConnectionAdded, ConnectionRemoved, SyncFailed       |

### 9.4 Scaling Considerations

Aura is a local desktop application. Traditional horizontal scaling does not apply. The relevant scaling vectors are:

| Vector                           | Concern                                                    | Mitigation                                                         |
|----------------------------------|------------------------------------------------------------|--------------------------------------------------------------------|
| Number of providers              | Each provider adds sync time and API calls                 | Parallel sync across providers. Provider adapter isolation.         |
| Number of issues                 | Large issue counts (>5000) may impact UI rendering         | Virtual scrolling/pagination in the UI. SQLite indexing.            |
| Number of repositories           | Filesystem scanning can be slow with >500 repos            | Graft delegation. Incremental scanning. Caching last-known state.  |
| API rate limits                  | Heavy sync with many repos/issues may hit rate limits      | Adaptive polling: increase intervals when approaching rate limits. |

---

## 10. Risk Register

| Risk ID | Description                                                                                                    | Probability | Impact   | Mitigation Strategy                                                                                               |
|---------|----------------------------------------------------------------------------------------------------------------|-------------|----------|-------------------------------------------------------------------------------------------------------------------|
| RSK-001 | **FogBugz API instability**: FogBugz API is legacy and varies between versions. May require version-specific adapters. | High        | Medium   | Implement a FogBugz adapter that gracefully handles missing fields. Defer FogBugz to Phase 2 if adapter cost is high. |
| RSK-002 | **PAT scope insufficiency**: Users may create PATs with insufficient scopes, causing partial data retrieval. **Mitigated by CLI auth.** When using `gh` or `az` CLI-based auth, scope management is handled by the CLI's OAuth flow -- the user does not manually select scopes. This risk is reduced to the PAT fallback path only. | Low (CLI) / High (PAT fallback) | Medium   | For CLI auth: scope is managed by the CLI. For PAT fallback: on connection setup, perform a scope validation request (check `X-OAuth-Scopes` header for GitHub, validate API access for Azure DevOps) and warn the user about missing scopes. |
| RSK-003 | **Graft web API breaking changes**: Graft is in active development. Web API endpoint or response schema changes could break Aura integration. | Medium      | High     | Pin to a minimum Graft API version. Validate response schemas defensively. Integration test suite against Graft web API. Version negotiation on startup. |
| RSK-004 | **Squash merge detection accuracy**: Detecting squash-merged branches is non-trivial (no common ancestor in git). | Medium      | Medium   | Use provider API (GitHub/Azure DevOps) to check PR merge status rather than relying solely on git diff analysis.   |
| RSK-005 | **Credential security breach**: Improper storage of credentials could expose connected accounts. Risk is reduced with CLI auth (tokens are extracted on-demand, not stored by Aura) but remains for PAT fallback and Jira/FogBugz tokens. | Low         | Critical | CLI-extracted tokens: held in memory only, never persisted. PAT fallback and Jira/FogBugz tokens: OS Keychain only. Security review before v1 release. No credential logging. Memory-only token handling. |
| RSK-006 | **API rate limiting during initial sync**: First sync pulls all data, which may exhaust rate limits.             | Medium      | Medium   | Implement progressive sync with pagination delays. Show progress to user. Allow sync cancellation.                 |
| RSK-007 | **Cross-platform compatibility**: macOS-first development may introduce platform-specific assumptions.           | Medium      | Medium   | Abstract OS-specific operations (Keychain, terminal launch, editor detection) behind platform adapters early.       |
| RSK-008 | **Feature overlap with Graft**: Unclear boundary between Aura and Graft responsibilities may lead to conflicting UX. | Medium  | High     | Define clear contract: Graft owns git operations (stacks, worktrees, repo discovery). Aura owns aggregation UI, issue tracking, session management. Document this boundary. |
| RSK-009 | **Graft web API availability**: Graft must be running locally for Graft-dependent features to work. If the user has not started Graft, or Graft crashes, features like repo discovery delegation, stacked branches, worktree management, and branch cleanup are unavailable. | Medium      | Medium   | Graceful degradation: all Graft-dependent features show a clear "Graft is not running" notice with instructions to start it. Core features (issue tracking, basic repo listing, session launching) operate independently. Consider auto-detecting and prompting the user to start Graft. |
| RSK-010 | **CLI dependency not installed**: GitHub CLI (`gh`) or Azure CLI (`az`) may not be installed on the user's machine, preventing CLI-based auth. This is especially relevant for users on managed/locked-down machines where installing CLIs requires IT approval. | Medium      | Low      | PAT fallback ensures full functionality without CLIs. On startup, Aura detects CLI availability (check `gh --version` and `az --version`). If a CLI is missing, Aura prompts the user to either install it (with a link to the install page) or configure a PAT. The connection setup UI clearly shows which auth method is active and why. |
| RSK-011 | **CLI token extraction subprocess overhead**: Invoking `gh auth token` or `az account get-access-token` as a subprocess for every API call may introduce latency. Azure CLI in particular can be slow (~1-3 seconds for token extraction). | Medium      | Low      | Cache the extracted token in memory with a short TTL (e.g., 5 minutes for `gh`, token expiry minus 5 minutes for `az`). Re-extract only when the cache expires or an API call returns 401. This avoids repeated subprocess invocations while keeping tokens fresh. |

---

## 11. Implementation Phasing

### Phase 1: Foundation (MVP)

**Goal**: Tauri application shell, core infrastructure, GitHub integration (CLI-first auth), and local repo management. No sync -- everything is fetched on-demand.

| Requirement | Description                                     | Priority |
|-------------|-------------------------------------------------|----------|
| --          | **Tauri shell setup** (app scaffold, webview, Rust backend, build pipeline) | P0 |
| FR-020*     | Authentication & Connection Management (CLI detection + PAT fallback) | P0 |
| --          | **Auth Resolution Layer**: Detect `gh` CLI availability (`gh --version`), extract tokens (`gh auth token`), fall back to PAT if CLI unavailable. Health check via `gh auth status`. | P0 |
| NFR-001     | Secure credential storage (OS Keychain for PAT fallback only) | P0 |
| NFR-003     | Local database (SQLite) setup                    | P0       |
| FR-001      | Issue retrieval (GitHub only, on-demand, using `gh` CLI auth) | P0 |
| FR-004      | Unified issue data model                         | P0       |
| FR-010      | Local repository discovery (without Graft)       | P0       |
| FR-016      | Development session launching                    | P0       |
| FR-015      | Pull request aggregation (GitHub only)           | P0       |

*FR-020 (Authentication & Connection Management) is implied but not individually specified above. It covers the settings UI for adding/removing/testing provider connections, CLI detection and status display, and PAT fallback configuration.

**Feature Flag**: `aura.providers.github.enabled` (default: true)

**Rollback**: N/A (first release)

**Exit Criteria**: A user can authenticate via `gh` CLI (or configure a GitHub PAT as fallback), see assigned issues and PRs (fetched on-demand), browse local repos, and launch an editor -- all within a Tauri desktop application. The simplest onboarding path is: install `gh`, run `gh auth login`, launch Aura -- zero additional configuration needed for GitHub.

### Phase 2: Multi-Provider, Sync, and Graft

**Goal**: Azure DevOps (with `az` CLI auth) and Jira integration, issue synchronization, Graft web API integration, branch cleanup.

| Requirement | Description                                     | Priority |
|-------------|-------------------------------------------------|----------|
| --          | **Azure CLI auth**: Detect `az` CLI availability (`az --version`), extract tokens (`az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798`), fall back to PAT if CLI unavailable. Health check via `az account show`. In-memory token caching with TTL. | P0 |
| FR-001      | Issue retrieval (Azure DevOps via `az` CLI auth, Jira via API token) | P0 |
| FR-002      | Issue synchronization (all configured providers) | P2       |
| FR-015      | PR aggregation (Azure DevOps)                    | P0       |
| FR-011      | Remote repository cloning                        | P1       |
| FR-017      | Graft web API integration                        | P1       |
| FR-010      | Repo discovery via Graft delegation              | P1       |
| FR-013      | Worktree management                              | P1       |
| FR-014      | Stacked branch management via Graft              | P1       |
| FR-012      | Post-squash-merge branch cleanup (via Graft)     | P1       |
| FR-003      | Issue-to-artifact linking                        | P0       |

**Feature Flags**: `aura.providers.azuredevops.enabled`, `aura.providers.jira.enabled`, `aura.integrations.graft.enabled`, `aura.features.sync.enabled`

**Rollback**: Disable provider flags to revert to GitHub-only mode. Disable sync flag to revert to on-demand fetching.

**Exit Criteria**: A user can connect GitHub + Azure DevOps + Jira, see a unified issue view with background sync, link issues to repos/branches/PRs, use Graft (via web API) for stacked branches and branch cleanup.

### Phase 3: Dashboards and Polish

**Goal**: FogBugz integration, custom dashboards, offline resilience, extensibility.

| Requirement | Description                                     | Priority |
|-------------|-------------------------------------------------|----------|
| FR-001      | Issue retrieval (FogBugz)                        | P1       |
| FR-018      | Custom dashboard creation                        | P2       |
| NFR-004     | Offline behavior hardening                       | P1       |
| NFR-005     | Observability and logging                        | P2       |
| NFR-006     | Accessibility (WCAG 2.1 AA)                      | P2       |
| NFR-007     | Plugin architecture for new providers            | P2       |

**Feature Flags**: `aura.providers.fogbugz.enabled`, `aura.features.dashboards.enabled`

**Rollback**: Disable feature flags for individual capabilities.

**Exit Criteria**: All four providers are functional. Dashboards are configurable. The app is usable offline with cached data.

---

## 12. Glossary

| Term                  | Definition |
|-----------------------|------------|
| **Aura**              | The application specified in this document. A unified developer workspace. |
| **Graft**             | A cross-platform tool for stacked branch and worktree management that exposes a web API. Created by the same developer. Repository: https://github.com/radaiko/graft |
| **GitHub CLI (`gh`)**  | The official GitHub command-line tool. Aura uses it as the primary authentication source for GitHub by extracting OAuth tokens via `gh auth token`. Install: https://cli.github.com/ |
| **Azure CLI (`az`)**   | Microsoft's command-line tool for Azure services. Aura uses it as the primary authentication source for Azure DevOps by extracting bearer tokens via `az account get-access-token`. Tokens are short-lived (~1 hour) and auto-refreshed. Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli |
| **PAT**               | Personal Access Token. A credential used to authenticate with GitHub or Azure DevOps APIs. In Aura, PATs serve as a **manual fallback** when CLI-based authentication (`gh`/`az`) is unavailable. |
| **Provider**          | An external system that Aura integrates with (GitHub, Jira, FogBugz, Azure DevOps). |
| **Adapter**           | A software component that translates between a provider's API and Aura's internal data model. |
| **Stacked Branches**  | A workflow where feature branches are chained in a dependency graph rather than all branching from a single base branch. Changes propagate bottom-to-top. |
| **Worktree**          | A Git feature that allows checking out multiple branches simultaneously in different directories within the same repository. |
| **Squash Merge**      | A merge strategy where all commits from a feature branch are combined into a single commit on the target branch. This makes standard `git branch --merged` detection unreliable. |
| **Artifact**          | A development object that can be linked to an issue: a repository, branch, or pull request. |
| **Sync**              | The process of fetching current data from a remote provider and updating the local cache. Unidirectional (remote to local). Not part of MVP -- deferred to Phase 2. In MVP, issues are fetched on-demand only. |
| **Session**           | The act of opening a repository in an editor, terminal, or AI coding tool for active development. |

---

## 13. Open Questions

These questions MUST be resolved before implementation begins on the affected requirements. Each question is tagged with the requirements it blocks.

| ID    | Question                                                                                                             | Blocks         | Status  |
|-------|----------------------------------------------------------------------------------------------------------------------|----------------|---------|
| OQ-001 | What is the target platform for Aura's UI?                                                                          | All FR         | **Resolved** -- Tauri desktop application with a web frontend. |
| OQ-002 | Is Firebase intended for authentication, data persistence, hosting, or a combination?                               | NFR-003, Arch  | **Resolved** -- Firebase has no role in the project. The `firebase-debug.log` was an artifact; all Firebase references have been removed. |
| OQ-003 | What specific "AI coding sessions" should Aura support?                                                             | FR-016         | **Resolved** -- Claude Code, GitHub CLI (`gh copilot`), Codex (OpenAI Codex CLI), OpenCode. |
| OQ-004 | Should Aura support multiple accounts per provider (e.g., two GitHub PATs for personal and work)?                   | FR-020         | **Partially Resolved** -- CLI-based auth provides native multi-account support: `gh auth switch` for GitHub, `az account set` for Azure DevOps. Aura SHOULD detect available accounts and let the user select. For PAT fallback and for Jira/FogBugz, multi-account support remains an open question. |
| OQ-005 | Is Jira Cloud, Jira Data Center, or both in scope?                                                                  | FR-001, 7.3    | Open    |
| OQ-006 | What is the target FogBugz version? Is it a hosted Manuscript instance or on-premises?                              | FR-001, 7.4    | Open    |
| OQ-007 | Should dashboards persist only locally, or sync across devices?                                                      | FR-018         | Open (dashboards are local-only for now; cross-device sync is a future consideration) |
| OQ-008 | Is cross-platform support (Windows, Linux) required for v1, or is macOS-only acceptable initially?                  | NFR-002, RSK-007 | Open |
| OQ-009 | Should issue sync ever be bidirectional (e.g., update status from Aura)?                                            | FR-002         | Open    |
| OQ-010 | What is Graft's minimum API version that Aura should target? Is there a stable web API contract?                    | FR-017, RSK-003 | Open   |

---

*End of document. This PRD is a living document and MUST be updated as open questions are resolved and requirements evolve.*
