import type { SeoReportSnapshot } from '~/lib/rankly-seo-report/types';

function scoreColour(score: number | null): string {
  if (score == null) return 'text-zinc-400';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function priorityClass(priority: string): string {
  if (priority === 'high') return 'bg-rose-100 text-rose-800';
  if (priority === 'medium') return 'bg-amber-100 text-amber-900';
  return 'bg-zinc-100 text-zinc-700';
}

export function SeoReportView(props: {
  snapshot: SeoReportSnapshot;
  brandName?: string | null;
  logoUrl?: string | null;
  pdfUrl?: string | null;
}) {
  const { snapshot } = props;

  return (
    <div className="space-y-10">
      <header className="space-y-4 border-b border-zinc-200 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {props.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.logoUrl}
                alt={props.brandName ?? 'Brand'}
                className="mb-3 h-10 w-auto object-contain"
              />
            ) : props.brandName ? (
              <p className="text-sm font-medium text-zinc-500">
                {props.brandName}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              SEO Report
            </h1>
            <p className="text-sm text-zinc-500">
              {snapshot.targetDomain} ·{' '}
              {new Date(snapshot.generatedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          {props.pdfUrl ? (
            <a
              href={props.pdfUrl}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Download PDF
            </a>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Overall score
          </p>
          <p
            className={`mt-1 text-4xl font-bold tabular-nums ${scoreColour(snapshot.overallScore)}`}
          >
            {snapshot.overallScore ?? '—'}
            <span className="text-lg font-normal text-zinc-400">/100</span>
          </p>
          {snapshot.executiveSummary ? (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-700">
              {snapshot.executiveSummary}
            </p>
          ) : null}
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Pillar scores</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-xl border border-zinc-200 bg-white p-4"
            >
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                {pillar.label}
              </p>
              {pillar.available ? (
                <p
                  className={`mt-2 text-3xl font-bold tabular-nums ${scoreColour(pillar.score)}`}
                >
                  {pillar.score ?? '—'}
                  <span className="text-base font-normal text-zinc-400">
                    /100
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm font-medium text-zinc-400">
                  Not yet run
                </p>
              )}
              {pillar.hint ? (
                <p className="mt-2 text-xs text-zinc-500">{pillar.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {snapshot.recommendations.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Top recommendations
          </h2>
          <div className="space-y-3">
            {snapshot.recommendations.map((rec, index) => (
              <article
                key={`${rec.title}-${index}`}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${priorityClass(rec.priority)}`}
                  >
                    {rec.priority}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase">
                    {rec.dimension}
                  </span>
                  {rec.isQuickWin ? (
                    <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-800 uppercase">
                      Quick win
                    </span>
                  ) : null}
                </div>
                <h3 className="font-medium text-zinc-900">{rec.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{rec.description}</p>
                {rec.outcome ? (
                  <p className="mt-2 text-sm text-emerald-700">
                    <span className="font-medium">Outcome:</span> {rec.outcome}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Appendix</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Authority</h3>
            {snapshot.appendix.authority.available ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Domain power</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.domainPower ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Link trust</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.linkTrust ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Referring domains</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.referringDomains ?? '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not yet run</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">PageSpeed</h3>
            {snapshot.appendix.pagespeed.available ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Mobile</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.pagespeed.mobile ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Desktop</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.pagespeed.desktop ?? '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not yet run</p>
            )}
          </div>
        </div>

        {snapshot.appendix.keywords.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Keyword snapshot
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Keyword</th>
                    <th className="px-4 py-2 font-medium">Device</th>
                    <th className="px-4 py-2 font-medium">Position</th>
                    <th className="px-4 py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.appendix.keywords.map((row) => (
                    <tr
                      key={`${row.keyword}-${row.device}`}
                      className="border-t border-zinc-100"
                    >
                      <td className="px-4 py-2 text-zinc-900">{row.keyword}</td>
                      <td className="px-4 py-2 text-zinc-500">{row.device}</td>
                      <td className="px-4 py-2 text-zinc-900 tabular-nums">
                        {row.position ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 tabular-nums">
                        {row.positionChange == null
                          ? '—'
                          : row.positionChange > 0
                            ? `+${row.positionChange}`
                            : row.positionChange}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {snapshot.appendix.crawlIssues.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Top crawl issues
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.appendix.crawlIssues.map((issue) => (
                <li
                  key={issue.code}
                  className="flex justify-between gap-4 text-zinc-700"
                >
                  <span className="font-mono text-xs">{issue.code}</span>
                  <span className="tabular-nums">{issue.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
