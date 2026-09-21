import { Skeleton } from '@kit/ui/skeleton';
import { cn } from '@kit/ui/utils';

const pulse = 'bg-[var(--workspace-shell-sidebar-accent)]';

export function DisposalsListSkeleton({
  view = 'cards',
  count = 8,
  className,
}: {
  view?: 'cards' | 'table';
  count?: number;
  className?: string;
}) {
  if (view === 'table') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
          className,
        )}
        aria-busy="true"
        aria-label="Loading disposals"
      >
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 last:border-b-0"
          >
            <Skeleton className={cn('h-8 w-8 shrink-0 rounded-lg', pulse)} />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn('h-3.5 w-2/5 max-w-48 rounded', pulse)} />
              <Skeleton className={cn('h-3 w-1/3 max-w-36 rounded', pulse)} />
            </div>
            <Skeleton
              className={cn('hidden h-5 w-16 rounded-full sm:block', pulse)}
            />
            <Skeleton
              className={cn('hidden h-5 w-14 rounded-full md:block', pulse)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
      aria-busy="true"
      aria-label="Loading disposals"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
        >
          <Skeleton className={cn('aspect-[16/10] rounded-none', pulse)} />
          <div className="space-y-2 p-4">
            <Skeleton className={cn('h-4 w-3/4 rounded', pulse)} />
            <Skeleton className={cn('h-3 w-1/2 rounded', pulse)} />
            <Skeleton className={cn('mt-2 h-3 w-1/3 rounded', pulse)} />
          </div>
        </div>
      ))}
    </div>
  );
}
