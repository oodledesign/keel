import { Skeleton } from '@kit/ui/skeleton';
import { cn } from '@kit/ui/utils';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

export function FinancesDashboardSkeleton() {
  return (
    <div className="animate-in fade-in space-y-6 duration-200">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn(panelClass, 'p-4')}>
            <Skeleton className="h-4 w-20 bg-white/10" />
            <Skeleton className="mt-3 h-8 w-32 bg-white/10" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={cn(panelClass, 'p-4')}>
            <Skeleton className="h-4 w-36 bg-white/10" />
            <Skeleton className="mt-2 h-3 w-48 bg-white/10" />
            <Skeleton className="mt-4 h-72 w-full rounded-xl bg-white/10" />
          </div>
        ))}
      </div>

      <div className={cn(panelClass, 'p-4')}>
        <Skeleton className="h-4 w-44 bg-white/10" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl bg-white/10" />
      </div>

      <div className={cn(panelClass, 'p-4')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24 bg-white/10" />
            <Skeleton className="h-4 w-full max-w-xl bg-white/10" />
            <Skeleton className="h-4 w-2/3 max-w-md bg-white/10" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md bg-white/10" />
        </div>
      </div>

      <div className={cn(panelClass, 'overflow-hidden')}>
        <div className="border-b border-white/6 px-4 py-3">
          <Skeleton className="h-5 w-28 bg-white/10" />
        </div>
        <div className="space-y-0 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[100px_1fr_100px_120px_80px] items-center gap-3 border-b border-white/4 px-2 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-20 bg-white/10" />
              <Skeleton className="h-4 w-full max-w-xs bg-white/10" />
              <Skeleton className="h-4 w-16 bg-white/10" />
              <Skeleton className="h-8 w-full bg-white/10" />
              <Skeleton className="h-4 w-14 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
