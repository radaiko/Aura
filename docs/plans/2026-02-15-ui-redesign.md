# Aura UI Redesign — "Obsidian Glass" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete visual overhaul of the Aura frontend — new color system, Geist typography, 48px icon rail navigation, unified issue/PR lists with provider badges, redesigned repos page and card-based settings. All CSS-only animations. No backend changes.

**Architecture:** Frontend-only redesign. All existing hooks, types, and Tauri commands remain unchanged. New shared UI primitives (PageHeader, SkeletonRows, ProviderIcon, StatusPill) replace duplicated patterns. Provider-specific list components (IssueList, AzureWorkItemList, JiraIssueList, FogBugzCaseList) are replaced by a single `UnifiedItemRow` that renders any provider's data using a discriminated union wrapper type. A shared `timeAgo` utility replaces 5 duplicated copies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Geist Sans + Geist Mono fonts (CDN), CSS custom properties, CSS keyframe animations.

**Design doc:** `docs/plans/2026-02-15-ui-redesign-design.md`

---

### Task 1: Fonts & CSS Foundation

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

**Step 1: Add Geist fonts to index.html**

Add font preload and stylesheet links in `<head>`:

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css" />
```

**Step 2: Set up CSS custom properties and animations in index.css**

Replace the entire `src/index.css` with:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  --color-base: #0a0c10;
  --color-raised: #0f1117;
  --color-hover: #141720;
  --color-border: #1e2130;
  --color-text-primary: #e2e4e9;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #3d4350;
  --color-accent: #3b82f6;
  --color-accent-muted: #1e3a5f;
  --color-status-green: #22c55e;
  --color-status-amber: #f59e0b;
  --color-status-red: #ef4444;
}

/* Shimmer skeleton animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Stagger fade-in for list items */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page content entrance */
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Single pulse for connected status dots */
@keyframes pulseOnce {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-shimmer {
  background: linear-gradient(90deg, var(--color-raised) 25%, var(--color-hover) 50%, var(--color-raised) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.animate-fade-in-up {
  animation: fadeInUp 0.2s ease-out both;
}

.animate-page-enter {
  animation: pageEnter 0.2s ease-out both;
}

.animate-pulse-once {
  animation: pulseOnce 0.6s ease-in-out 1;
}
```

**Step 3: Run dev server to verify fonts load**

Run: `cd /Users/radaiko/dev/Aura && pnpm tauri dev`
Expected: App renders with Geist Sans as the default font. No visual breakage.

**Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat(ui): add Geist fonts and CSS design tokens for Obsidian Glass theme"
```

---

### Task 2: Shared UI Utilities

**Files:**
- Create: `src/lib/timeAgo.ts`
- Create: `src/components/ProviderIcon.tsx`
- Create: `src/components/StatusPill.tsx`
- Create: `src/components/SkeletonRows.tsx`
- Create: `src/components/PageHeader.tsx`
- Modify: `src/components/Spinner.tsx`

**Step 1: Create timeAgo utility**

Extract the duplicated `timeAgo` function into a shared module. This function exists identically in IssueList.tsx, AzureWorkItemList.tsx, AzurePRList.tsx, JiraIssueList.tsx, and FogBugzCaseList.tsx.

Create `src/lib/timeAgo.ts`:

```ts
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}
```

**Step 2: Create ProviderIcon component**

Create `src/components/ProviderIcon.tsx`. Small inline SVG icons for each provider:

```tsx
const icons: Record<string, JSX.Element> = {
  github: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  azure: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M7.47 0L3.2 5.27 0 12.15h3.48L7.47 0zm.87 1.89L5.8 7.57l3.8 4.58-6.28 1.2H16L8.34 1.89z" />
    </svg>
  ),
  jira: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M15.52 7.27L8.73.48 8 0l-5.34 5.34-.19.19L.48 7.52a.63.63 0 000 .96l4.55 4.55L8 16l2.97-2.97.04-.04 4.51-4.76a.63.63 0 000-.96zM8 10.37L5.63 8 8 5.63 10.37 8 8 10.37z" />
    </svg>
  ),
  fogbugz: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a2 2 0 110 4 2 2 0 010-4zM8 13c-1.93 0-3.63-.97-4.65-2.45.02-1.54 3.1-2.39 4.65-2.39 1.54 0 4.63.85 4.65 2.39A5.48 5.48 0 018 13z" />
    </svg>
  ),
};

export function ProviderIcon({ provider, className = "" }: { provider: string; className?: string }) {
  return (
    <span className={`text-text-secondary ${className}`}>
      {icons[provider] ?? null}
    </span>
  );
}
```

**Step 3: Create StatusPill component**

Create `src/components/StatusPill.tsx`:

```tsx
const statusStyles: Record<string, string> = {
  open: "bg-status-green/15 text-status-green",
  "in progress": "bg-accent/15 text-accent",
  "in_progress": "bg-accent/15 text-accent",
  active: "bg-status-green/15 text-status-green",
  new: "bg-accent/15 text-accent",
  resolved: "bg-status-amber/15 text-status-amber",
  closed: "bg-text-tertiary/15 text-text-tertiary",
};

export function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status.toLowerCase()] ?? "bg-text-tertiary/15 text-text-secondary";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style}`}>
      {status}
    </span>
  );
}
```

**Step 4: Create SkeletonRows component**

Create `src/components/SkeletonRows.tsx`:

```tsx
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-md">
          <div className="w-4 h-4 rounded animate-shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 rounded animate-shimmer w-3/4" />
            <div className="h-2.5 rounded animate-shimmer w-1/3" />
          </div>
          <div className="h-5 w-14 rounded-full animate-shimmer" />
          <div className="h-3 w-6 rounded animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Create PageHeader component**

Create `src/components/PageHeader.tsx`:

```tsx
import { Spinner } from "./Spinner";

export function PageHeader({
  title,
  loading,
  count,
  onRefresh,
  refreshDisabled,
  children,
}: {
  title: string;
  loading?: boolean;
  count?: number;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-mono text-text-tertiary bg-raised px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
        {loading && <Spinner />}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshDisabled}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-hover transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M13.65 2.35A7 7 0 103.17 12.83" />
              <path d="M14 1v3.5h-3.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 6: Update Spinner colors**

Modify `src/components/Spinner.tsx` — update colors to use new palette:

```tsx
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-3.5 w-3.5 text-text-tertiary ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

**Step 7: Commit**

```bash
git add src/lib/timeAgo.ts src/components/ProviderIcon.tsx src/components/StatusPill.tsx src/components/SkeletonRows.tsx src/components/PageHeader.tsx src/components/Spinner.tsx
git commit -m "feat(ui): add shared UI primitives for Obsidian Glass theme"
```

---

### Task 3: AppLayout — Icon Rail Navigation

**Files:**
- Modify: `src/layouts/AppLayout.tsx`

**Step 1: Rewrite AppLayout with icon rail**

Replace the entire file. The new layout uses a 48px icon rail with SVG icons, active pill indicator, and the Aura logo mark at the top. Settings is pinned to the bottom.

```tsx
import type { ReactNode } from "react";

type Page = "issues" | "prs" | "repos" | "settings";

const NAV_ITEMS: { id: Page; label: string; icon: JSX.Element }[] = [
  {
    id: "issues",
    label: "Issues",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4" />
        <circle cx="10" cy="13" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "prs",
    label: "Pull Requests",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="15" r="2" />
        <circle cx="14" cy="15" r="2" />
        <path d="M6 7v6M14 7v6" />
        <path d="M14 7a4 4 0 00-4-4H8" />
      </svg>
    ),
  },
  {
    id: "repos",
    label: "Repositories",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M3 4h14v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
        <path d="M3 4a2 2 0 012-2h5l2 2" />
        <path d="M3 9h14" />
      </svg>
    ),
  },
];

const SETTINGS_ITEM = {
  id: "settings" as Page,
  label: "Settings",
  icon: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.42 1.42M15.18 15.18l1.42 1.42M3.4 16.6l1.42-1.42M15.18 4.82l1.42-1.42" />
    </svg>
  ),
};

export function AppLayout({
  activePage,
  onNavigate,
  children,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const renderNavButton = (item: { id: Page; label: string; icon: JSX.Element }) => {
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        title={item.label}
        className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
          isActive
            ? "text-accent bg-accent-muted"
            : "text-text-tertiary hover:text-text-secondary hover:bg-hover"
        }`}
      >
        {item.icon}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-base text-text-primary font-sans">
      {/* Icon Rail */}
      <nav className="w-12 bg-raised border-r border-border flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-8 h-8 mb-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent">
            <defs>
              <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#aura-glow)" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        </div>

        {/* Main nav */}
        {NAV_ITEMS.map(renderNavButton)}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings at bottom */}
        {renderNavButton(SETTINGS_ITEM)}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 animate-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}

export type { Page };
```

**Step 2: Run dev server and verify**

Run: `pnpm tauri dev`
Expected: Icon rail on the left (48px), all 4 navigation icons visible, active state shows blue accent, settings pinned to bottom. Main content renders correctly.

**Step 3: Commit**

```bash
git add src/layouts/AppLayout.tsx
git commit -m "feat(ui): replace sidebar with 48px icon rail navigation"
```

---

### Task 4: Issues Page — Unified List

**Files:**
- Modify: `src/pages/IssuesPage.tsx`
- Remove old components after this task: `src/components/IssueList.tsx`, `src/components/AzureWorkItemList.tsx`, `src/components/JiraIssueList.tsx`, `src/components/FogBugzCaseList.tsx` (keep until Task 5 also done)

**Step 1: Rewrite IssuesPage with unified list**

The key change: instead of rendering 4 separate list components in sections, we merge all items into a single array using a discriminated union, sort by updated date, and render a unified list with provider icons.

Replace the entire `src/pages/IssuesPage.tsx`:

```tsx
import { useEffect, useRef, useMemo } from "react";
import { useGitHubAuth, useGitHubIssues } from "../hooks/useGitHub";
import { useAzureAuth, useAzureWorkItems } from "../hooks/useAzure";
import { useJiraAuth, useJiraIssues } from "../hooks/useJira";
import { useFogBugzAuth, useFogBugzCases } from "../hooks/useFogBugz";
import { PageHeader } from "../components/PageHeader";
import { SkeletonRows } from "../components/SkeletonRows";
import { ProviderIcon } from "../components/ProviderIcon";
import { StatusPill } from "../components/StatusPill";
import { timeAgo } from "../lib/timeAgo";
import { repoFromUrl } from "../types";
import type { GitHubIssue, AzureWorkItem, JiraIssue, FogBugzCase } from "../types";

type UnifiedIssue =
  | { provider: "github"; data: GitHubIssue; updated: number }
  | { provider: "azure"; data: AzureWorkItem; updated: number }
  | { provider: "jira"; data: JiraIssue; updated: number }
  | { provider: "fogbugz"; data: FogBugzCase; updated: number };

function toUnified(
  ghIssues: GitHubIssue[],
  azItems: AzureWorkItem[],
  jiraIssues: JiraIssue[],
  fbCases: FogBugzCase[],
): UnifiedIssue[] {
  const items: UnifiedIssue[] = [
    ...ghIssues.map((d) => ({ provider: "github" as const, data: d, updated: new Date(d.updated_at).getTime() })),
    ...azItems.map((d) => ({ provider: "azure" as const, data: d, updated: new Date(d.changed_date).getTime() })),
    ...jiraIssues.map((d) => ({ provider: "jira" as const, data: d, updated: new Date(d.updated).getTime() })),
    ...fbCases.map((d) => ({ provider: "fogbugz" as const, data: d, updated: new Date(d.updated).getTime() })),
  ];
  items.sort((a, b) => b.updated - a.updated);
  return items;
}

function IssueKey({ item }: { item: UnifiedIssue }) {
  switch (item.provider) {
    case "github":
      return <span className="font-mono">{repoFromUrl(item.data.repository_url)} #{item.data.number}</span>;
    case "azure":
      return (
        <span className="font-mono">
          <span className="text-text-secondary">{item.data.work_item_type}</span> #{item.data.id}
        </span>
      );
    case "jira":
      return (
        <span className="font-mono">
          {item.data.key} <span className="text-text-tertiary">{item.data.project}</span>
        </span>
      );
    case "fogbugz":
      return (
        <span className="font-mono">
          <span className="text-text-secondary">{item.data.category}</span> #{item.data.id}
        </span>
      );
  }
}

function getTitle(item: UnifiedIssue): string {
  switch (item.provider) {
    case "github": return item.data.title;
    case "azure": return item.data.title;
    case "jira": return item.data.summary;
    case "fogbugz": return item.data.title;
  }
}

function getStatus(item: UnifiedIssue): string {
  switch (item.provider) {
    case "github": return item.data.state;
    case "azure": return item.data.state;
    case "jira": return item.data.status;
    case "fogbugz": return item.data.status;
  }
}

function getUrl(item: UnifiedIssue): string {
  switch (item.provider) {
    case "github": return item.data.html_url;
    case "azure": return item.data.url;
    case "jira": return item.data.url;
    case "fogbugz": return item.data.url;
  }
}

function getLabels(item: UnifiedIssue): { name: string; color?: string }[] {
  switch (item.provider) {
    case "github":
      return item.data.labels.slice(0, 2).map((l) => ({ name: l.name, color: l.color }));
    case "azure":
      return item.data.tags.slice(0, 2).map((t) => ({ name: t }));
    case "jira":
      return item.data.labels.slice(0, 2).map((l) => ({ name: l }));
    case "fogbugz":
      return item.data.tags.slice(0, 2).map((t) => ({ name: t }));
  }
}

function getUpdated(item: UnifiedIssue): string {
  switch (item.provider) {
    case "github": return item.data.updated_at;
    case "azure": return item.data.changed_date;
    case "jira": return item.data.updated;
    case "fogbugz": return item.data.updated;
  }
}

export function IssuesPage({ active }: { active: boolean }) {
  const { status: ghStatus, loading: ghAuthLoading } = useGitHubAuth();
  const { issues, loading: ghLoading, error: ghError, fetch: ghFetch } = useGitHubIssues();

  const { status: azStatus, loading: azAuthLoading } = useAzureAuth();
  const { items: azItems, loading: azLoading, error: azError, fetch: azFetch } = useAzureWorkItems();

  const { config: jiraConfig, status: jiraStatus, loading: jiraAuthLoading } = useJiraAuth();
  const { issues: jiraIssues, loading: jiraLoading, error: jiraError, fetch: jiraFetch } = useJiraIssues();

  const { config: fbConfig, status: fbStatus, loading: fbAuthLoading } = useFogBugzAuth();
  const { cases: fbCases, loading: fbLoading, error: fbError, fetch: fbFetch } = useFogBugzCases();

  const mounted = useRef(false);

  useEffect(() => {
    if (ghStatus?.auth_method !== "none") ghFetch();
  }, [ghStatus, ghFetch]);

  useEffect(() => {
    if (azStatus?.logged_in && azStatus.organization && azStatus.project) azFetch();
  }, [azStatus, azFetch]);

  useEffect(() => {
    if (jiraStatus?.valid && jiraConfig) jiraFetch(jiraConfig);
  }, [jiraStatus, jiraConfig, jiraFetch]);

  useEffect(() => {
    if (fbStatus?.valid && fbConfig) fbFetch(fbConfig);
  }, [fbStatus, fbConfig, fbFetch]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) {
      if (ghStatus?.auth_method !== "none") ghFetch();
      if (azStatus?.logged_in && azStatus.organization && azStatus.project) azFetch();
      if (jiraStatus?.valid && jiraConfig) jiraFetch(jiraConfig);
      if (fbStatus?.valid && fbConfig) fbFetch(fbConfig);
    }
  }, [active]);

  const ghConnected = ghStatus && ghStatus.auth_method !== "none";
  const azConnected = azStatus?.logged_in && azStatus.organization && azStatus.project;
  const jiraConnected = jiraStatus?.valid && jiraConfig;
  const fbConnected = fbStatus?.valid && fbConfig;
  const allAuthLoading = ghAuthLoading && azAuthLoading && jiraAuthLoading && fbAuthLoading;
  const anyLoading = ghLoading || azLoading || jiraLoading || fbLoading;
  const neitherConnected = !ghAuthLoading && !azAuthLoading && !jiraAuthLoading && !fbAuthLoading &&
    !ghConnected && !azConnected && !jiraConnected && !fbConnected;

  const unified = useMemo(
    () => toUnified(issues, azItems, jiraIssues, fbCases),
    [issues, azItems, jiraIssues, fbCases],
  );

  const hasData = unified.length > 0;
  const isInitialLoad = allAuthLoading && !hasData;
  const isLoading = anyLoading && !hasData;

  // Collect per-provider errors
  const errors: { provider: string; message: string; retry: () => void }[] = [];
  if (ghError && ghConnected) errors.push({ provider: "GitHub", message: ghError, retry: ghFetch });
  if (azError && azConnected) errors.push({ provider: "Azure DevOps", message: azError, retry: azFetch });
  if (jiraError && jiraConnected) errors.push({ provider: "Jira", message: jiraError, retry: () => jiraFetch(jiraConfig) });
  if (fbError && fbConnected) errors.push({ provider: "FogBugz", message: fbError, retry: () => fbFetch(fbConfig) });

  const handleRefresh = () => {
    if (ghConnected) ghFetch();
    if (azConnected) azFetch();
    if (jiraConnected) jiraFetch(jiraConfig);
    if (fbConnected) fbFetch(fbConfig);
  };

  return (
    <div>
      <PageHeader
        title="Issues"
        loading={anyLoading && hasData}
        count={hasData ? unified.length : undefined}
        onRefresh={neitherConnected ? undefined : handleRefresh}
        refreshDisabled={anyLoading}
      />

      {/* Error banners */}
      {errors.map((err) => (
        <div key={err.provider} className="flex items-center justify-between bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">
            <span className="font-medium">{err.provider}</span>: {err.message}
          </p>
          <button onClick={err.retry} className="text-xs text-text-secondary hover:text-text-primary transition-colors ml-3">
            Retry
          </button>
        </div>
      ))}

      {isInitialLoad && <SkeletonRows count={5} />}

      {neitherConnected && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-raised flex items-center justify-center mb-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-text-tertiary">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 7v3l2 1" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-1">No services connected</p>
          <p className="text-xs text-text-tertiary">Set up GitHub CLI, Azure CLI, or add credentials in Settings.</p>
        </div>
      )}

      {isLoading && !isInitialLoad && <SkeletonRows count={4} />}

      {hasData && (
        <ul className="space-y-0.5">
          {unified.map((item, i) => (
            <li
              key={`${item.provider}-${item.provider === "github" ? item.data.id : item.provider === "jira" ? item.data.key : item.data.id}`}
              className="animate-fade-in-up"
              style={{ animationDelay: i < 20 ? `${i * 30}ms` : "0ms" }}
            >
              <a
                href={getUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-hover transition-colors duration-120 group"
              >
                <ProviderIcon provider={item.provider} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text-primary group-hover:text-white truncate">
                    {getTitle(item)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    <IssueKey item={item} />
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getLabels(item).map((label) => (
                    <span
                      key={label.name}
                      className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-raised text-text-secondary"
                      style={label.color ? { backgroundColor: `#${label.color}20`, color: `#${label.color}` } : undefined}
                    >
                      {label.name}
                    </span>
                  ))}
                  <StatusPill status={getStatus(item)} />
                  <span className="text-[11px] font-mono text-text-tertiary w-6 text-right">
                    {timeAgo(getUpdated(item))}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !isInitialLoad && !neitherConnected && !hasData && errors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-text-secondary">No open issues assigned to you.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run dev server and verify**

Run: `pnpm tauri dev`
Expected: Issues page shows a single unified list with provider icons, status pills, stagger animation on load. All items sorted by updated date.

**Step 3: Commit**

```bash
git add src/pages/IssuesPage.tsx
git commit -m "feat(ui): unified issue list with provider icons and stagger animation"
```

---

### Task 5: Pull Requests Page — Unified List

**Files:**
- Modify: `src/pages/PullRequestsPage.tsx`

**Step 1: Rewrite PullRequestsPage with unified PR list**

Same pattern as Issues — merge GitHub PRs and Azure PRs into a single sorted list. GitHub PRs use the `GitHubIssue` type (with `pull_request` field set). Azure PRs use `AzurePullRequest`.

Replace the entire `src/pages/PullRequestsPage.tsx`:

```tsx
import { useEffect, useRef, useMemo } from "react";
import { useGitHubAuth, useGitHubPRs } from "../hooks/useGitHub";
import { useAzureAuth, useAzurePRs } from "../hooks/useAzure";
import { PageHeader } from "../components/PageHeader";
import { SkeletonRows } from "../components/SkeletonRows";
import { ProviderIcon } from "../components/ProviderIcon";
import { timeAgo } from "../lib/timeAgo";
import { repoFromUrl } from "../types";
import type { GitHubIssue, AzurePullRequest } from "../types";

type UnifiedPR =
  | { provider: "github"; data: GitHubIssue; updated: number }
  | { provider: "azure"; data: AzurePullRequest; updated: number };

function toUnified(ghPrs: GitHubIssue[], azPrs: AzurePullRequest[]): UnifiedPR[] {
  const items: UnifiedPR[] = [
    ...ghPrs.map((d) => ({ provider: "github" as const, data: d, updated: new Date(d.updated_at).getTime() })),
    ...azPrs.map((d) => ({ provider: "azure" as const, data: d, updated: new Date(d.creation_date).getTime() })),
  ];
  items.sort((a, b) => b.updated - a.updated);
  return items;
}

export function PullRequestsPage({ active }: { active: boolean }) {
  const { status: ghStatus, loading: ghAuthLoading } = useGitHubAuth();
  const { prs: ghPrs, loading: ghLoading, error: ghError, fetch: ghFetch } = useGitHubPRs();

  const { status: azStatus, loading: azAuthLoading } = useAzureAuth();
  const { prs: azPrs, loading: azLoading, error: azError, fetch: azFetch } = useAzurePRs();

  const mounted = useRef(false);

  useEffect(() => {
    if (ghStatus?.auth_method !== "none") ghFetch();
  }, [ghStatus, ghFetch]);

  useEffect(() => {
    if (azStatus?.logged_in && azStatus.organization && azStatus.project) azFetch();
  }, [azStatus, azFetch]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) {
      if (ghStatus?.auth_method !== "none") ghFetch();
      if (azStatus?.logged_in && azStatus.organization && azStatus.project) azFetch();
    }
  }, [active]);

  const ghConnected = ghStatus && ghStatus.auth_method !== "none";
  const azConnected = azStatus?.logged_in && azStatus.organization && azStatus.project;
  const anyLoading = ghLoading || azLoading;
  const neitherConnected = !ghAuthLoading && !azAuthLoading && !ghConnected && !azConnected;

  const unified = useMemo(() => toUnified(ghPrs, azPrs), [ghPrs, azPrs]);
  const hasData = unified.length > 0;
  const isInitialLoad = ghAuthLoading && azAuthLoading && !hasData;

  const errors: { provider: string; message: string; retry: () => void }[] = [];
  if (ghError && ghConnected) errors.push({ provider: "GitHub", message: ghError, retry: ghFetch });
  if (azError && azConnected) errors.push({ provider: "Azure DevOps", message: azError, retry: azFetch });

  const handleRefresh = () => {
    if (ghConnected) ghFetch();
    if (azConnected) azFetch();
  };

  return (
    <div>
      <PageHeader
        title="Pull Requests"
        loading={anyLoading && hasData}
        count={hasData ? unified.length : undefined}
        onRefresh={neitherConnected ? undefined : handleRefresh}
        refreshDisabled={anyLoading}
      />

      {errors.map((err) => (
        <div key={err.provider} className="flex items-center justify-between bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">
            <span className="font-medium">{err.provider}</span>: {err.message}
          </p>
          <button onClick={err.retry} className="text-xs text-text-secondary hover:text-text-primary transition-colors ml-3">
            Retry
          </button>
        </div>
      ))}

      {isInitialLoad && <SkeletonRows count={4} />}

      {neitherConnected && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-raised flex items-center justify-center mb-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-text-tertiary">
              <circle cx="6" cy="5" r="2" />
              <circle cx="6" cy="15" r="2" />
              <circle cx="14" cy="15" r="2" />
              <path d="M6 7v6M14 7v6" />
              <path d="M14 7a4 4 0 00-4-4H8" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-1">No services connected</p>
          <p className="text-xs text-text-tertiary">
            Set up GitHub CLI or Azure CLI to see your pull requests.
          </p>
        </div>
      )}

      {anyLoading && !hasData && !isInitialLoad && <SkeletonRows count={3} />}

      {hasData && (
        <ul className="space-y-0.5">
          {unified.map((item, i) => (
            <li
              key={`${item.provider}-${item.data.id}`}
              className="animate-fade-in-up"
              style={{ animationDelay: i < 20 ? `${i * 30}ms` : "0ms" }}
            >
              <a
                href={item.provider === "github" ? item.data.html_url : item.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-hover transition-colors duration-120 group"
              >
                <ProviderIcon provider={item.provider} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text-primary group-hover:text-white truncate">
                    {item.data.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5 font-mono">
                    {item.provider === "github" ? (
                      <>
                        {repoFromUrl(item.data.repository_url)} #{item.data.number}
                      </>
                    ) : (
                      <>
                        {item.data.repository}
                        <span className="text-text-tertiary mx-1.5">{item.data.source_branch}</span>
                        <span className="text-text-tertiary">→</span>
                        <span className="text-text-tertiary ml-1.5">{item.data.target_branch}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.provider === "azure" && (
                    <span className="text-[11px] text-text-secondary">{item.data.created_by}</span>
                  )}
                  <span className="text-[11px] font-mono text-text-tertiary w-6 text-right">
                    {timeAgo(item.provider === "github" ? item.data.updated_at : item.data.creation_date)}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!anyLoading && !isInitialLoad && !neitherConnected && !hasData && errors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-text-secondary">No open pull requests for you.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run dev server and verify**

Run: `pnpm tauri dev`
Expected: PR page shows unified list with GitHub and Azure PRs interleaved, sorted by date. Provider icons visible. Stagger animation on load.

**Step 3: Commit**

```bash
git add src/pages/PullRequestsPage.tsx
git commit -m "feat(ui): unified PR list with provider icons"
```

---

### Task 6: Repos Page — Visual Refresh

**Files:**
- Modify: `src/pages/ReposPage.tsx`

**Step 1: Rewrite ReposPage with new visual design**

Apply the Obsidian Glass theme to the repos page. Key changes: colored status dots, monospace branch names with git-branch icon, icon-only tool launch buttons that appear on hover, tighter tree indentation, PageHeader component.

Replace the entire `src/pages/ReposPage.tsx`:

```tsx
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos, type LocalRepo } from "../hooks/useRepos";
import { PageHeader } from "../components/PageHeader";
import { SkeletonRows } from "../components/SkeletonRows";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

interface TreeNode {
  repos: LocalRepo[];
  children: Map<string, TreeNode>;
}

function buildTree(repos: LocalRepo[], roots: string[]): TreeNode {
  const root: TreeNode = { repos: [], children: new Map() };

  for (const repo of repos) {
    const scanRoot = roots.find((r) => repo.path.startsWith(r + "/"));
    const relative = scanRoot ? repo.path.slice(scanRoot.length + 1) : repo.name;
    const segments = relative.split("/");

    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!node.children.has(seg)) {
        node.children.set(seg, { repos: [], children: new Map() });
      }
      node = node.children.get(seg)!;
    }
    node.repos.push(repo);
  }

  return collapseTree(root);
}

function collapseTree(node: TreeNode): TreeNode {
  const collapsed: TreeNode = { repos: node.repos, children: new Map() };

  for (const [name, child] of node.children) {
    let collapsedChild = collapseTree(child);
    let label = name;
    while (collapsedChild.repos.length === 0 && collapsedChild.children.size === 1) {
      const [subName, subChild] = [...collapsedChild.children.entries()][0];
      label = `${label}/${subName}`;
      collapsedChild = subChild;
    }
    collapsed.children.set(label, collapsedChild);
  }

  return collapsed;
}

function countRepos(node: TreeNode): number {
  let count = node.repos.length;
  for (const child of node.children.values()) {
    count += countRepos(child);
  }
  return count;
}

export function ReposPage({ active }: { active: boolean }) {
  const { repos, loading, error, scan } = useRepos();
  const [roots, setRoots] = useState<string[]>([]);
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const mounted = useRef(false);
  const rootsRef = useRef<string[]>([]);

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools).catch(() => {});
    loadRoots();
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) loadRoots();
  }, [active]);

  const loadRoots = async () => {
    try {
      const db = await Database.load("sqlite:aura.db");
      const rows = await db.select<{ path: string }[]>("SELECT path FROM scan_roots");
      const paths = rows.map((r) => r.path);
      setRoots(paths);
      rootsRef.current = paths;
      if (paths.length > 0) scan(paths);
    } catch (err) {
      setDbError(String(err));
    }
  };

  const tree = useMemo(() => buildTree(repos, roots), [repos, roots]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleFolder = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Repositories"
        loading={loading && repos.length > 0}
        count={repos.length > 0 ? repos.length : undefined}
        onRefresh={roots.length > 0 ? () => scan(roots) : undefined}
        refreshDisabled={loading}
      />

      {dbError && (
        <div className="bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">{dbError}</p>
        </div>
      )}
      {error && (
        <div className="bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">{error}</p>
        </div>
      )}

      {roots.length === 0 && !dbError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-raised flex items-center justify-center mb-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-text-tertiary">
              <path d="M3 4h14v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
              <path d="M3 4a2 2 0 012-2h5l2 2" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-1">No scan directories configured</p>
          <p className="text-xs text-text-tertiary">Add directories in Settings to discover repositories.</p>
        </div>
      )}

      {loading && repos.length === 0 && roots.length > 0 && <SkeletonRows count={6} />}

      {repos.length > 0 && (
        <FolderTree node={tree} tools={tools} collapsed={collapsed} onToggle={toggleFolder} />
      )}

      {!loading && repos.length === 0 && roots.length > 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-secondary">No Git repositories found in the configured directories.</p>
        </div>
      )}
    </div>
  );
}

function FolderTree({
  node,
  tools,
  depth = 0,
  collapsed,
  onToggle,
  pathPrefix = "",
}: {
  node: TreeNode;
  tools: SessionTool[];
  depth?: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  pathPrefix?: string;
}) {
  const sortedFolders = [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sortedRepos = [...node.repos].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={depth > 0 ? "ml-5 border-l border-border pl-3" : ""}>
      {sortedFolders.map(([name, child]) => {
        const folderPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        const isCollapsed = collapsed.has(folderPath);
        const repoCount = countRepos(child);
        return (
          <div key={name} className={depth > 0 ? "mt-1" : "mt-2 first:mt-0"}>
            <button
              onClick={() => onToggle(folderPath)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-2 py-1.5 rounded-md hover:bg-hover transition-colors w-full text-left"
            >
              <svg
                className={`h-3 w-3 shrink-0 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-text-tertiary">
                <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.622 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
              </svg>
              <span>{name}</span>
              {isCollapsed && (
                <span className="text-text-tertiary font-mono font-normal text-[10px] ml-auto">{repoCount}</span>
              )}
            </button>
            {!isCollapsed && (
              <FolderTree
                node={child}
                tools={tools}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                pathPrefix={folderPath}
              />
            )}
          </div>
        );
      })}
      {sortedRepos.map((repo) => (
        <RepoRow key={repo.path} repo={repo} tools={tools} />
      ))}
    </div>
  );
}

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
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-hover transition-colors duration-120 group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            repo.is_dirty ? "bg-status-amber" : "bg-status-green"
          }`}
        />
        <span className="text-[13px] font-medium text-text-primary truncate">{repo.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-120">
        {availableTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => launch(tool.id)}
            title={tool.name}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-text-primary hover:bg-accent-muted transition-colors"
          >
            <ToolIcon name={tool.name} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 text-text-tertiary">
          <path d="M5 3v10M11 3v6" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <path d="M11 9c0 2.2-1.8 4-4 4" />
        </svg>
        <span className="text-xs text-text-secondary font-mono">{repo.current_branch}</span>
      </div>
    </div>
  );
}

function ToolIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("code") || lower.includes("vs")) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M11.5 1l-7 5.5L11.5 12V1zM4 6.5L1 4v8l3-2.5" />
      </svg>
    );
  }
  if (lower.includes("terminal")) {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
        <path d="M2 4l4 4-4 4M8 12h6" />
      </svg>
    );
  }
  // Generic tool icon
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8h6" />
    </svg>
  );
}
```

**Step 2: Run dev server and verify**

Run: `pnpm tauri dev`
Expected: Repos page uses new theme — colored status dots (green/amber), monospace branch names with git icon, icon-only tool buttons on hover, tighter tree with border lines. PageHeader with refresh and count.

**Step 3: Commit**

```bash
git add src/pages/ReposPage.tsx
git commit -m "feat(ui): repos page with status dots, icon tool launchers, and new theme"
```

---

### Task 7: Settings Page — Card Layout

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/PathAutocomplete.tsx`

**Step 1: Update PathAutocomplete styling**

Update the input and dropdown styles in `src/components/PathAutocomplete.tsx` to use new color tokens. Change:
- Input background: `bg-zinc-900` → `bg-base`
- Input border: `border-zinc-700` → `border-border`
- Input focus: `focus:border-zinc-500` → `focus:border-accent/50 focus:ring-1 focus:ring-accent/20`
- Input text: `text-zinc-100` → `text-text-primary`
- Input placeholder: `placeholder-zinc-600` → `placeholder-text-tertiary`
- Dropdown bg: `bg-zinc-900` → `bg-raised`
- Dropdown border: `border-zinc-700` → `border-border`
- Selected item: `bg-zinc-700` → `bg-accent-muted`
- Hover item: `hover:bg-zinc-800` → `hover:bg-hover`
- Item text: `text-zinc-300` → `text-text-primary`

Replace the input className on line 103:
```
"w-full bg-base border border-border rounded-md px-3 py-1.5 text-sm text-text-primary font-mono placeholder-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
```

Replace the dropdown `ul` className on line 106:
```
"absolute z-10 top-full left-0 right-0 mt-1 bg-raised border border-border rounded-md overflow-hidden shadow-lg max-h-60 overflow-y-auto"
```

Replace the dropdown button className on line 111:
```
`w-full text-left px-3 py-1.5 text-sm font-mono truncate transition-colors ${
  i === selectedIndex
    ? "bg-accent-muted text-white"
    : "text-text-primary hover:bg-hover"
}`
```

**Step 2: Rewrite SettingsPage with card layout**

Replace the entire `src/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState, useRef } from "react";
import { useGitHubAuth } from "../hooks/useGitHub";
import { useAzureAuth } from "../hooks/useAzure";
import { useJiraAuth, saveJiraConfig, deleteJiraConfig } from "../hooks/useJira";
import { useFogBugzAuth, saveFogBugzConfig, deleteFogBugzConfig } from "../hooks/useFogBugz";
import { invoke } from "@tauri-apps/api/core";
import { PathAutocomplete } from "../components/PathAutocomplete";
import { Spinner } from "../components/Spinner";
import { PageHeader } from "../components/PageHeader";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-0.5">{title}</h3>
      {description && <p className="text-xs text-text-tertiary mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </div>
  );
}

function ConnectionStatus({
  connected,
  loading,
  label,
  sublabel,
  onCheck,
  onDisconnect,
}: {
  connected: boolean;
  loading: boolean;
  label: string;
  sublabel?: string;
  onCheck: () => void;
  onDisconnect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {loading ? (
          <Spinner />
        ) : (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? "bg-status-green animate-pulse-once" : "bg-text-tertiary"
            }`}
          />
        )}
        <div>
          <span className="text-sm text-text-primary">{label}</span>
          {sublabel && <span className="text-xs text-text-secondary ml-2">{sublabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCheck}
          className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          Re-check
        </button>
        {onDisconnect && connected && (
          <button
            onClick={onDisconnect}
            className="text-[11px] text-text-tertiary hover:text-status-red transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ active }: { active: boolean }) {
  const { status: ghStatus, loading: ghLoading, refresh: ghRefresh } = useGitHubAuth();
  const { status: azStatus, loading: azLoading, refresh: azRefresh } = useAzureAuth();
  const { config: jiraConfig, status: jiraStatus, loading: jiraLoading, refresh: jiraRefresh } = useJiraAuth();
  const { config: fbConfig, status: fbStatus, loading: fbLoading, refresh: fbRefresh } = useFogBugzAuth();
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [roots, setRoots] = useState<{ id: string; path: string }[]>([]);
  const [newRoot, setNewRoot] = useState("");
  const mounted = useRef(false);

  const [jiraForm, setJiraForm] = useState({ instance_url: "", email: "", api_token: "" });
  const [jiraSaving, setJiraSaving] = useState(false);
  const [jiraFormError, setJiraFormError] = useState<string | null>(null);

  const [fbForm, setFbForm] = useState({ instance_url: "", email: "", password: "" });
  const [fbSaving, setFbSaving] = useState(false);
  const [fbFormError, setFbFormError] = useState<string | null>(null);

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools);
    loadRoots();
  }, []);

  useEffect(() => {
    if (jiraConfig) {
      setJiraForm({ instance_url: jiraConfig.instance_url, email: jiraConfig.email, api_token: jiraConfig.api_token });
    }
  }, [jiraConfig]);

  useEffect(() => {
    if (fbConfig) {
      setFbForm({ instance_url: fbConfig.instance_url, email: fbConfig.email, password: fbConfig.password });
    }
  }, [fbConfig]);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (active) {
      ghRefresh(); azRefresh(); jiraRefresh(); fbRefresh();
      invoke<SessionTool[]>("detect_session_tools").then(setTools);
      loadRoots();
    }
  }, [active]);

  const loadRoots = async () => {
    const db = await Database.load("sqlite:aura.db");
    const rows = await db.select<{ id: string; path: string }[]>("SELECT id, path FROM scan_roots ORDER BY path");
    setRoots(rows);
  };

  const addRoot = async () => {
    const trimmed = newRoot.trim();
    if (!trimmed) return;
    const db = await Database.load("sqlite:aura.db");
    await db.execute("INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)", [crypto.randomUUID(), trimmed]);
    setNewRoot("");
    loadRoots();
  };

  const removeRoot = async (id: string) => {
    const db = await Database.load("sqlite:aura.db");
    await db.execute("DELETE FROM scan_roots WHERE id = ?", [id]);
    loadRoots();
  };

  const handleJiraSave = async () => {
    const { instance_url, email, api_token } = jiraForm;
    if (!instance_url.trim() || !email.trim() || !api_token.trim()) { setJiraFormError("All fields are required."); return; }
    setJiraSaving(true); setJiraFormError(null);
    try { await saveJiraConfig({ instance_url: instance_url.trim(), email: email.trim(), api_token: api_token.trim() }); await jiraRefresh(); }
    catch (err) { setJiraFormError(String(err)); }
    finally { setJiraSaving(false); }
  };

  const handleJiraDisconnect = async () => {
    await deleteJiraConfig();
    setJiraForm({ instance_url: "", email: "", api_token: "" });
    await jiraRefresh();
  };

  const handleFogBugzSave = async () => {
    const { instance_url, email, password } = fbForm;
    if (!instance_url.trim() || !email.trim() || !password.trim()) { setFbFormError("All fields are required."); return; }
    setFbSaving(true); setFbFormError(null);
    try { await saveFogBugzConfig({ instance_url: instance_url.trim(), email: email.trim(), password: password.trim() }); await fbRefresh(); }
    catch (err) { setFbFormError(String(err)); }
    finally { setFbSaving(false); }
  };

  const handleFogBugzDisconnect = async () => {
    await deleteFogBugzConfig();
    setFbForm({ instance_url: "", email: "", password: "" });
    await fbRefresh();
  };

  const inputClass =
    "w-full bg-base border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20";

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHeader title="Settings" />

      <div className="space-y-4">
        {/* GitHub */}
        <SettingsCard title="GitHub" description="Authenticates via GitHub CLI (gh)">
          <ConnectionStatus
            connected={!!ghStatus?.cli_authenticated}
            loading={ghLoading}
            label={ghStatus?.cli_authenticated ? "Connected" : ghStatus?.cli_available ? "CLI installed but not authenticated" : "GitHub CLI not found"}
            sublabel={ghStatus?.username ? `@${ghStatus.username}` : undefined}
            onCheck={ghRefresh}
          />
        </SettingsCard>

        {/* Azure DevOps */}
        <SettingsCard title="Azure DevOps" description="Authenticates via Azure CLI (az)">
          <ConnectionStatus
            connected={!!azStatus?.logged_in}
            loading={azLoading}
            label={azStatus?.logged_in ? "Connected" : azStatus?.cli_available ? "CLI installed but not logged in" : "Azure CLI not found"}
            sublabel={azStatus?.organization && azStatus?.project ? `${azStatus.organization} / ${azStatus.project}` : undefined}
            onCheck={azRefresh}
          />
        </SettingsCard>

        {/* Jira */}
        <SettingsCard title="Jira Cloud" description="API token authentication">
          {jiraStatus?.valid ? (
            <ConnectionStatus
              connected
              loading={jiraLoading && !!jiraStatus}
              label="Connected"
              sublabel={jiraStatus.display_name ?? undefined}
              onCheck={jiraRefresh}
              onDisconnect={handleJiraDisconnect}
            />
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Instance URL</label>
                <input type="text" value={jiraForm.instance_url} onChange={(e) => setJiraForm((f) => ({ ...f, instance_url: e.target.value }))} placeholder="https://yourteam.atlassian.net" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Email</label>
                <input type="email" value={jiraForm.email} onChange={(e) => setJiraForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@company.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  API Token
                  <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="ml-2 text-accent/60 hover:text-accent underline">Create token</a>
                </label>
                <input type="password" value={jiraForm.api_token} onChange={(e) => setJiraForm((f) => ({ ...f, api_token: e.target.value }))} placeholder="Your Jira API token" className={inputClass} />
              </div>
              {jiraFormError && <p className="text-status-red text-xs">{jiraFormError}</p>}
              <button onClick={handleJiraSave} disabled={jiraSaving} className="px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50">
                {jiraSaving ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </SettingsCard>

        {/* FogBugz */}
        <SettingsCard title="FogBugz" description="Username and password authentication">
          {fbStatus?.valid ? (
            <ConnectionStatus
              connected
              loading={fbLoading && !!fbStatus}
              label="Connected"
              sublabel={fbStatus.person_name ?? undefined}
              onCheck={fbRefresh}
              onDisconnect={handleFogBugzDisconnect}
            />
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Instance URL</label>
                <input type="text" value={fbForm.instance_url} onChange={(e) => setFbForm((f) => ({ ...f, instance_url: e.target.value }))} placeholder="https://yourteam.fogbugz.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Email</label>
                <input type="email" value={fbForm.email} onChange={(e) => setFbForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@company.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Password</label>
                <input type="password" value={fbForm.password} onChange={(e) => setFbForm((f) => ({ ...f, password: e.target.value }))} placeholder="Your FogBugz password" className={inputClass} />
              </div>
              {fbFormError && <p className="text-status-red text-xs">{fbFormError}</p>}
              <button onClick={handleFogBugzSave} disabled={fbSaving} className="px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50">
                {fbSaving ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </SettingsCard>

        {/* Scan Directories */}
        <SettingsCard title="Scan Directories" description="Root directories to search for Git repositories">
          {roots.length > 0 && (
            <div className="space-y-1 mb-3">
              {roots.map((root) => (
                <div key={root.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-base">
                  <span className="text-xs text-text-secondary font-mono truncate">{root.path}</span>
                  <button onClick={() => removeRoot(root.id)} className="text-[11px] text-text-tertiary hover:text-status-red transition-colors ml-2 shrink-0">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <PathAutocomplete value={newRoot} onChange={setNewRoot} onSubmit={addRoot} placeholder="/Users/you/dev" />
            <button onClick={addRoot} className="px-3 py-1.5 bg-hover text-sm text-text-secondary rounded-md hover:bg-accent-muted hover:text-text-primary transition-colors shrink-0">
              Add
            </button>
          </div>
        </SettingsCard>

        {/* Detected Tools */}
        <SettingsCard title="Detected Tools" description="Editors, terminals, and AI coding tools found on your system">
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-base">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tool.available ? "bg-status-green" : "bg-text-tertiary"}`} />
                <span className={`text-xs ${tool.available ? "text-text-primary" : "text-text-tertiary"}`}>{tool.name}</span>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
```

**Step 3: Run dev server and verify**

Run: `pnpm tauri dev`
Expected: Settings page shows cards with borders, status dots that pulse green when connected, clean form inputs with accent focus rings, 2-column tool grid, monospace paths in scan directories.

**Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx src/components/PathAutocomplete.tsx
git commit -m "feat(ui): card-based settings page with connection status dots"
```

---

### Task 8: Cleanup — Remove Old Components

**Files:**
- Delete: `src/components/IssueList.tsx`
- Delete: `src/components/AzureWorkItemList.tsx`
- Delete: `src/components/AzurePRList.tsx`
- Delete: `src/components/JiraIssueList.tsx`
- Delete: `src/components/FogBugzCaseList.tsx`

**Step 1: Verify no imports reference old components**

Search the codebase for any remaining imports of the old list components. After Tasks 4 and 5, IssuesPage and PullRequestsPage no longer import them.

Run: `grep -r "IssueList\|AzureWorkItemList\|AzurePRList\|JiraIssueList\|FogBugzCaseList" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches (all old imports were replaced in Tasks 4 and 5).

**Step 2: Delete the old component files**

```bash
rm src/components/IssueList.tsx src/components/AzureWorkItemList.tsx src/components/AzurePRList.tsx src/components/JiraIssueList.tsx src/components/FogBugzCaseList.tsx
```

**Step 3: Run build to confirm no broken imports**

Run: `pnpm build`
Expected: Build succeeds with no errors.

**Step 4: Run tests**

Run: `pnpm test`
Expected: All tests pass. (The App.test.tsx test checks for "Aura" text which is now in the logo area.)

**Step 5: Commit**

```bash
git add -u
git commit -m "refactor(ui): remove old provider-specific list components"
```

---

### Task 9: Final Verification

**Step 1: Run the app and check all pages**

Run: `pnpm tauri dev`

Verify:
- [ ] Icon rail renders with 4 icons, settings at bottom, Aura logo at top
- [ ] Active icon has blue accent pill background
- [ ] Issues page shows unified list with provider icons, status pills, time-ago, stagger animation
- [ ] Pull Requests page shows unified list with branch arrows for Azure PRs
- [ ] Repos page shows folder tree with status dots, branch names, icon-only tool launchers on hover
- [ ] Settings page shows cards with connection status dots, forms, tool grid
- [ ] Page transitions animate (fade + slide up)
- [ ] Skeleton loading shows shimmer effect
- [ ] Empty states show centered icons with messages
- [ ] Error banners show with red accent and retry buttons
- [ ] Geist Sans/Mono fonts are applied (check in devtools)
- [ ] Color palette is Obsidian Glass (deep charcoal, not zinc)

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "feat(ui): complete Obsidian Glass redesign"
```
