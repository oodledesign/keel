'use client';

const pulse = 'animate-pulse rounded-xl bg-white/[0.04]';

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 px-4 pb-12 pt-6 md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className={`h-10 w-72 ${pulse}`} />
          <div className={`h-4 w-48 ${pulse}`} />
        </div>
        <div className={`h-10 w-32 ${pulse}`} />
      </div>

      {/* Today's focus */}
      <section className="space-y-3">
        <div className={`h-6 w-36 ${pulse}`} />
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-16 w-full ${pulse}`} />
        ))}
      </section>

      {/* Work overview */}
      <section className="space-y-3">
        <div className={`h-6 w-40 ${pulse}`} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`h-48 ${pulse}`} />
          <div className={`h-48 ${pulse}`} />
        </div>
      </section>

      {/* Pipeline snapshot */}
      <section className="space-y-3">
        <div className={`h-6 w-44 ${pulse}`} />
        <div className={`h-20 ${pulse}`} />
      </section>

      {/* Life */}
      <section className="space-y-3">
        <div className={`h-6 w-36 ${pulse}`} />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-36 ${pulse}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
