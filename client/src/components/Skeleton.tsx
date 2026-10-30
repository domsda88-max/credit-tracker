export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-control ${className}`} aria-hidden />;
}
export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}