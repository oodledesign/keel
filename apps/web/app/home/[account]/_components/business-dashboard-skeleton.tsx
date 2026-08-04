const pulse =
  'animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]';

/**
 * Placeholder for workspace business dashboard while data streams in.
 */
export function BusinessDashboardSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-24 w-full ${pulse}`} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <div className={`h-5 w-36 ${pulse}`} />
          <div className={`h-40 w-full ${pulse}`} />
        </section>
        <section className="space-y-3">
          <div className={`h-5 w-40 ${pulse}`} />
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-14 w-full ${pulse}`} />
          ))}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className={`h-5 w-32 ${pulse}`} />
          {[1, 2].map((i) => (
            <div key={i} className={`h-16 w-full ${pulse}`} />
          ))}
        </section>
        <section className="space-y-3">
          <div className={`h-5 w-28 ${pulse}`} />
          {[1, 2].map((i) => (
            <div key={i} className={`h-16 w-full ${pulse}`} />
          ))}
        </section>
      </div>
    </div>
  );
}
