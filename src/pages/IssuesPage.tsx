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

function getItemKey(item: UnifiedIssue): string {
  switch (item.provider) {
    case "github": return `gh-${item.data.id}`;
    case "azure": return `az-${item.data.id}`;
    case "jira": return `jira-${item.data.key}`;
    case "fogbugz": return `fb-${item.data.id}`;
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
              key={getItemKey(item)}
              className="animate-fade-in-up"
              style={{ animationDelay: i < 20 ? `${i * 30}ms` : "0ms" }}
            >
              <a
                href={getUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-hover transition-colors group"
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
