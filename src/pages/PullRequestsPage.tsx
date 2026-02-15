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
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-hover transition-colors group"
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
                        <span className="text-text-tertiary">&rarr;</span>
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
