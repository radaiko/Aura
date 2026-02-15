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
