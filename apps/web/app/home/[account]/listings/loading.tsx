import { DisposalsListSkeleton } from './_components/disposals-list-skeleton';

export default function DisposalsLoading() {
  return (
    <div className="space-y-6 px-4 pt-8 pb-6 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-28 animate-pulse rounded bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        </div>
      </div>
      <DisposalsListSkeleton />
    </div>
  );
}
