import { cn } from "@/lib/utils/cn";

/** Loading placeholder (PRD §23). Respects prefers-reduced-motion via globals.css. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-primary-soft", className)} aria-hidden />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <Skeleton className="aspect-3/4 rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-4 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

export function ProfileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => <ProfileCardSkeleton key={i} />)}
    </div>
  );
}
