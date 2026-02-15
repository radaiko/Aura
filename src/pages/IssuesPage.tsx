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
