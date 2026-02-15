const statusStyles: Record<string, string> = {
  open: "bg-status-green/15 text-status-green",
  "in progress": "bg-accent/15 text-accent",
  in_progress: "bg-accent/15 text-accent",
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
