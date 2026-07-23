import {
  CRAWL_ISSUE_PLAIN,
  buildClientHeadline,
  buildClientNextSteps,
  enrichPillarForClient,
  scoreBand,
  scoreBandLabel,
} from '~/lib/rankly-seo-report/client-copy';
import type { SeoReportSnapshot } from '~/lib/rankly-seo-report/types';

function scoreColour(score: number | null): string {
  if (score == null) return 'text-zinc-400';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function bandBadgeClass(band: string): string {
  if (band === 'strong') return 'bg-emerald-50 text-emerald-800';
  if (band === 'ok') return 'bg-amber-50 text-amber-900';
  if (band === 'needs_work') return 'bg-orange-50 text-orange-900';
  if (band === 'critical') return 'bg-rose-50 text-rose-800';
  return 'bg-zinc-100 text-zinc-600';
}

function priorityClass(priority: string): string {
  if (priority === 'high') return 'bg-rose-100 text-rose-800';
  if (priority === 'medium') return 'bg-amber-100 text-amber-900';
  return 'bg-zinc-100 text-zinc-700';
}

function issueLabel(code: string, label?: string): string {
  return label || CRAWL_ISSUE_PLAIN[code] || code.replace(/_/g, ' ');
}

export function SeoReportView(props: {
  snapshot: SeoReportSnapshot;
  brandName?: string | null;
  logoUrl?: string | null;
  pdfUrl?: string | null;
}) {
  const { snapshot } = props;
  const headline =
    snapshot.clientHeadline?.trim() || buildClientHeadline(snapshot);
  const storedSteps = snapshot.nextSteps ?? [];
  const nextSteps =
    storedSteps.length > 0
      ? storedSteps
      : buildClientNextSteps(snapshot);
  const pillars = snapshot.pillars.map(enrichPillarForClient);
  const overallBand = scoreBand(snapshot.overallScore);

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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Overall score
              </p>
              <p
                className={`mt-1 text-4xl font-bold tabular-nums ${scoreColour(snapshot.overallScore)}`}
              >
                {snapshot.overallScore ?? '—'}
                <span className="text-lg font-normal text-zinc-400">/100</span>
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${bandBadgeClass(overallBand)}`}
              >
                {scoreBandLabel(overallBand)}
              </span>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
              Scores are out of 100. Higher is better. Rough guide: 75+ is in
              good shape, 50–74 has room to improve, below 50 needs attention.
            </p>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-800">
            {headline}
          </p>
          {snapshot.executiveSummary &&
          snapshot.executiveSummary.trim() !== headline.trim() ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
              {snapshot.executiveSummary}
            </p>
          ) : null}
        </div>
      </header>

      {nextSteps.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            What to do next
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            How your site scores
          </h2>
          <p className="text-sm text-zinc-500">
            Each score is one part of how customers find you in Google and AI
            answers. Read the short explanation under each number.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  {pillar.label}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${bandBadgeClass(pillar.band)}`}
                >
                  {pillar.bandLabel}
                </span>
              </div>
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
                  Not measured yet
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                {pillar.whatItMeans}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                <span className="font-medium text-zinc-600">Why it matters:</span>{' '}
                {pillar.whyItMatters}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {pillar.scoreExplainer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {snapshot.recommendations.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-900">
              Recommended actions
            </h2>
            <p className="text-sm text-zinc-500">
              Practical fixes, ordered by impact. Start at the top.
            </p>
          </div>
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
                    {rec.priority} priority
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
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {rec.description}
                </p>
                {rec.outcome ? (
                  <p className="mt-2 text-sm text-emerald-700">
                    <span className="font-medium">If you fix this:</span>{' '}
                    {rec.outcome}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Extra detail
          </h2>
          <p className="text-sm text-zinc-500">
            Supporting numbers from the scans behind this report.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Authority &amp; trust
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              How strong your site looks based on links from other websites.
            </p>
            {snapshot.appendix.authority.available ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Domain power (0–100)</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.domainPower ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Link trust (0–100)</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.linkTrust ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Other sites linking in</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.authority.referringDomains ?? '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not measured yet</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Page speed
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Google Lighthouse performance for your homepage (higher is
              faster).
            </p>
            {snapshot.appendix.pagespeed.available ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">On phones</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.pagespeed.mobile ?? '—'}
                    /100
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">On computers</dt>
                  <dd className="font-medium tabular-nums">
                    {snapshot.appendix.pagespeed.desktop ?? '—'}
                    /100
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not measured yet</p>
            )}
          </div>
        </div>

        {snapshot.appendix.keywords.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Keyword positions
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Where you currently appear for tracked search phrases. Position
                1 is the top of Google; lower numbers are better.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Search phrase</th>
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
                        {row.position ?? 'Not ranking'}
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
              Common technical issues found
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              How many pages have each problem. These are the main reasons the
              Technical SEO score may be low.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.appendix.crawlIssues.map((issue) => (
                <li
                  key={issue.code}
                  className="flex justify-between gap-4 text-zinc-700"
                >
                  <span>{issueLabel(issue.code, issue.label)}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {issue.count} page{issue.count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
