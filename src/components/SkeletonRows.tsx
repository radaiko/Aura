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
