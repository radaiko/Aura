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
