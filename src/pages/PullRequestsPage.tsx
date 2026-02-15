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
