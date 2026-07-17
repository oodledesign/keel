'use client';

const pulse =
  'animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]';

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 px-4 pt-6 pb-12 md:px-6 lg:px-8">
      <div className="space-y-2">
        <div className={`h-10 w-64 ${pulse}`} />
        <div className={`h-4 w-48 ${pulse}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className={`h-5 w-32 ${pulse}`} />
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-14 w-full ${pulse}`} />
            ))}
          </section>
          <section className="space-y-3">
            <div className={`h-5 w-24 ${pulse}`} />
            {[1, 2].map((i) => (
              <div key={i} className={`h-14 w-full ${pulse}`} />
            ))}
          </section>
        </div>
        <section className="space-y-3">
          <div className={`h-5 w-20 ${pulse}`} />
          <div className={`h-40 w-full ${pulse}`} />
        </section>
      </div>

      <section className="space-y-3">
        <div className={`h-5 w-44 ${pulse}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`h-48 ${pulse}`} />
          <div className={`h-48 ${pulse}`} />
        </div>
      </section>
    </div>
  );
}
