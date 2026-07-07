import { Skeleton } from '@kit/ui/skeleton';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { cn } from '@kit/ui/utils';

export function WorkspaceTablePageSkeleton({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className={cn(workspacePageMainClassName, 'min-h-0 space-y-4')}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <Skeleton className="h-4 w-64 rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 [--cols:5]">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={`head-${index}`}
              className="h-4 w-full max-w-24 rounded bg-[var(--workspace-shell-sidebar-accent)]"
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 last:border-b-0 [--cols:5]"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 w-full rounded bg-[var(--workspace-shell-sidebar-accent)]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceCardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className={cn(workspacePageMainClassName, 'min-h-0 space-y-4')}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <Skeleton className="h-4 w-56 rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Skeleton
            key={`card-${index}`}
            className="h-28 rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]"
          />
        ))}
      </div>
    </div>
  );
}
