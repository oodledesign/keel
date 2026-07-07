'use client';

const pulse = 'animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]';

export function BusinessDashboardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-12 pt-4 md:px-6 lg:px-8">
      <div className={`h-36 w-full ${pulse}`} />
      <div className={`h-10 w-full ${pulse}`} />
      <div className={`h-52 w-full ${pulse}`} />
      <div className="flex gap-3 overflow-hidden">
        <div className={`h-32 w-[calc(50%-0.375rem)] shrink-0 ${pulse}`} />
        <div className={`h-32 w-[calc(50%-0.375rem)] shrink-0 ${pulse}`} />
      </div>
    </div>
  );
}
