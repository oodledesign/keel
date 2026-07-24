import {
  ArrowUpRight,
  Building2,
  Cpu,
  Download,
  Eye,
  FileText,
  Link2,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';

import {
  CRAWL_ISSUE_PLAIN,
  buildClientHeadline,
  buildClientNextSteps,
  enrichPillarForClient,
  scoreBand,
  scoreBandLabel,
} from '~/lib/rankly-seo-report/client-copy';
import {
  PILLAR_ICON_HINT,
  buildOverallPotential,
  buildPillarPotentials,
  scoreTone,
} from '~/lib/rankly-seo-report/report-visuals';
import type { SeoReportSnapshot } from '~/lib/rankly-seo-report/types';

function bandBadgeClass(band: string): string {
  if (band === 'strong') return 'bg-emerald-100 text-emerald-800';
  if (band === 'ok') return 'bg-amber-100 text-amber-900';
  if (band === 'needs_work') return 'bg-orange-100 text-orange-900';
  if (band === 'critical') return 'bg-rose-100 text-rose-800';
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

function PillarIcon({ id }: { id: string }) {
  const hint = PILLAR_ICON_HINT[id] ?? 'file';
  const className = 'size-4';
  switch (hint) {
    case 'building':
      return <Building2 className={className} />;
    case 'file':
      return <FileText className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'wrench':
      return <Wrench className={className} />;
    case 'link':
      return <Link2 className={className} />;
    case 'eye':
      return <Eye className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function ScoreBar(props: {
  label: string;
  value: number | null;
  barClass: string;
  textClass: string;
  trackClass?: string;
  suffix?: string;
}) {
  const width =
    props.value == null ? 0 : Math.max(0, Math.min(100, props.value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-600">{props.label}</span>
        <span className={`font-semibold tabular-nums ${props.textClass}`}>
          {props.value ?? '—'}
          {props.value != null ? '/100' : ''}
          {props.suffix ? (
            <span className="ml-1 font-medium text-emerald-700">
              {props.suffix}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={`h-2.5 overflow-hidden rounded-full ${props.trackClass ?? 'bg-zinc-200/80'}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${props.barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ScoreCompareBars(props: {
  current: number | null;
  potential: number | null;
  uplift: number | null;
}) {
  const currentTone = scoreTone(props.current);
  const showPotential =
    props.potential != null &&
    props.uplift != null &&
    props.uplift > 0 &&
    props.current != null;

  return (
    <div className="space-y-3">
      <ScoreBar
        label="Today"
        value={props.current}
        barClass={currentTone.webBar}
        textClass={currentTone.webText}
        trackClass="bg-zinc-200/70"
      />
      {showPotential ? (
        <ScoreBar
          label="With recommended fixes"
          value={props.potential}
          barClass="bg-emerald-500"
          textClass="text-emerald-700"
          trackClass="bg-emerald-100"
          suffix={`(+${props.uplift})`}
        />
      ) : null}
    </div>
  );
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
    storedSteps.length > 0 ? storedSteps : buildClientNextSteps(snapshot);
  const pillars = snapshot.pillars.map(enrichPillarForClient);
  const pillarPotentials = buildPillarPotentials(snapshot);
  const overall = buildOverallPotential(snapshot, pillarPotentials);
  const overallBand = scoreBand(snapshot.overallScore);
  const maxIssueCount = Math.max(
    ...snapshot.appendix.crawlIssues.map((i) => i.count),
    1,
  );

  return (
    <div className="space-y-10">
      <header className="overflow-hidden rounded-2xl bg-[var(--ozer-plum-900,#351E28)] text-[var(--ozer-cream-50,#FBF6EC)] shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6 border-l-4 border-[var(--ozer-accent,#FF5C34)] p-6 sm:p-8">
          <div className="space-y-3">
            {props.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.logoUrl}
                alt={props.brandName ?? 'Brand'}
                className="mb-1 h-10 w-auto max-w-[180px] object-contain"
              />
            ) : props.brandName ? (
              <p className="text-sm font-medium text-[var(--ozer-accent,#FF5C34)]">
                {props.brandName}
              </p>
            ) : null}
            <h1 className="font-[family-name:var(--ozer-font-display,inherit)] text-3xl font-bold tracking-tight sm:text-4xl">
              SEO + AI Search Report
            </h1>
            <p className="text-sm text-[#B7A4AC]">
              {snapshot.targetDomain} ·{' '}
              {new Date(snapshot.generatedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {props.pdfUrl ? (
              <a
                href={props.pdfUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#FBF6EC] ring-1 ring-white/20 transition hover:bg-white/15"
              >
                <Download className="size-4" />
                Download PDF
              </a>
            ) : null}
            <div className="rounded-xl bg-white/10 px-5 py-3 text-right ring-1 ring-white/15">
              <p className="text-[10px] font-semibold tracking-wider text-[var(--ozer-accent,#FF5C34)] uppercase">
                Today
              </p>
              <p className="mt-0.5 text-4xl font-bold tabular-nums">
                {snapshot.overallScore ?? '—'}
                <span className="text-base font-normal text-[#B7A4AC]">
                  /100
                </span>
              </p>
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${bandBadgeClass(overallBand)}`}
              >
                {scoreBandLabel(overallBand)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[#E8DFD2] bg-white p-6 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[var(--ozer-accent,#FF5C34)]">
              <Sparkles className="size-4" />
              <p className="text-xs font-semibold tracking-wide uppercase">
                Opportunity
              </p>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Where you are vs where you could be
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Estimated lift if the recommended actions below are completed. Not
              a guarantee — a directional view of upside.
            </p>
          </div>
          {overall.uplift != null && overall.uplift > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
              <ArrowUpRight className="size-4" />+{overall.uplift} points
              possible
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <ScoreCompareBars
            current={overall.current}
            potential={overall.potential}
            uplift={overall.uplift}
          />
          {overall.potential != null ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center sm:min-w-[120px]">
              <p className="text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
                Potential
              </p>
              <p className="text-3xl font-bold text-emerald-800 tabular-nums">
                {overall.potential}
                <span className="text-sm font-normal text-emerald-600">
                  /100
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-base leading-relaxed text-zinc-800">
          {headline}
        </p>
        {snapshot.executiveSummary &&
        snapshot.executiveSummary.trim() !== headline.trim() ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            {snapshot.executiveSummary}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-zinc-400">
          Scores are out of 100. Rough guide: 75+ is in good shape, 50–74 has
          room to improve, below 50 needs attention.
        </p>
      </section>

      {nextSteps.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            What to do next
          </h2>
          <ol className="space-y-3">
            {nextSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-[#E8DFD2] bg-white p-4"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent,#FF5C34)] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-zinc-700">
                  {step}
                </span>
              </li>
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
            answers. Green bars show estimated upside after fixes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar) => {
            const pot = pillarPotentials.find((p) => p.id === pillar.id);
            const tone = scoreTone(pillar.available ? pillar.score : null);
            return (
              <div
                key={pillar.id}
                className="overflow-hidden rounded-xl border border-[#E8DFD2] bg-white shadow-sm"
              >
                <div className={`h-1 w-full ${tone.webBar}`} aria-hidden />
                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex size-8 items-center justify-center rounded-lg ${tone.webSoft} ${tone.webText}`}
                      >
                        <PillarIcon id={pillar.id} />
                      </span>
                      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        {pillar.label}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${bandBadgeClass(pillar.band)}`}
                    >
                      {pillar.bandLabel}
                    </span>
                  </div>

                  {pillar.available ? (
                    <ScoreCompareBars
                      current={pot?.current ?? pillar.score}
                      potential={pot?.potential ?? null}
                      uplift={pot?.uplift ?? null}
                    />
                  ) : (
                    <p className="text-sm font-medium text-zinc-400">
                      Not measured yet
                    </p>
                  )}

                  <p className="text-sm leading-relaxed text-zinc-700">
                    {pillar.whatItMeans}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    <span className="font-medium text-zinc-600">
                      Why it matters:
                    </span>{' '}
                    {pillar.whyItMatters}
                  </p>
                </div>
              </div>
            );
          })}
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
                className="rounded-xl border border-l-4 border-[#E8DFD2] border-l-[var(--ozer-accent,#FF5C34)] bg-white p-4 shadow-sm"
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
                    <span className="rounded bg-[color-mix(in_srgb,var(--ozer-accent,#FF5C34)_15%,white)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--ozer-accent,#FF5C34)] uppercase">
                      Quick win
                    </span>
                  ) : null}
                </div>
                <h3 className="font-medium text-zinc-900">{rec.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {rec.description}
                </p>
                {rec.outcome ? (
                  <p className="mt-2 flex gap-1.5 text-sm text-emerald-700">
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <span className="font-medium">If you fix this:</span>{' '}
                      {rec.outcome}
                    </span>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900">Extra detail</h2>
          <p className="text-sm text-zinc-500">
            Supporting numbers from the scans behind this report.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E8DFD2] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">
              Authority &amp; trust
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              How strong your site looks based on links from other websites.
            </p>
            {snapshot.appendix.authority.available ? (
              <dl className="mt-4 space-y-3 text-sm">
                {(
                  [
                    [
                      'Domain power (0–100)',
                      snapshot.appendix.authority.domainPower,
                    ],
                    [
                      'Link trust (0–100)',
                      snapshot.appendix.authority.linkTrust,
                    ],
                    [
                      'Other sites linking in',
                      snapshot.appendix.authority.referringDomains,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between gap-4">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="font-semibold text-zinc-900 tabular-nums">
                        {value ?? '—'}
                      </dd>
                    </div>
                    {typeof value === 'number' && label.includes('0–100') ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-[var(--ozer-info,#41606F)]"
                          style={{ width: `${Math.min(100, value)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not measured yet</p>
            )}
          </div>

          <div className="rounded-xl border border-[#E8DFD2] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">Page speed</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Google Lighthouse performance for your homepage (higher is
              faster).
            </p>
            {snapshot.appendix.pagespeed.available ? (
              <div className="mt-4 space-y-4">
                {(
                  [
                    ['On phones', snapshot.appendix.pagespeed.mobile],
                    ['On computers', snapshot.appendix.pagespeed.desktop],
                  ] as const
                ).map(([label, value]) => {
                  const tone = scoreTone(value);
                  return (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-zinc-500">{label}</span>
                        <span
                          className={`font-semibold tabular-nums ${tone.webText}`}
                        >
                          {value ?? '—'}/100
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full ${tone.webBar}`}
                          style={{
                            width: `${value == null ? 0 : Math.min(100, value)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Not measured yet</p>
            )}
          </div>
        </div>

        {snapshot.appendix.keywords.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#E8DFD2] bg-white shadow-sm">
            <div className="border-b border-[#E8DFD2] px-4 py-3">
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
                <thead className="bg-[#FBF6EC] text-xs tracking-wide text-zinc-500 uppercase">
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
                      className="border-t border-[#F0E8DC]"
                    >
                      <td className="px-4 py-2 text-zinc-900">{row.keyword}</td>
                      <td className="px-4 py-2 text-zinc-500">{row.device}</td>
                      <td className="px-4 py-2 text-zinc-900 tabular-nums">
                        {row.position ?? 'Not ranking'}
                      </td>
                      <td
                        className={`px-4 py-2 tabular-nums ${
                          row.positionChange != null && row.positionChange > 0
                            ? 'font-medium text-emerald-700'
                            : row.positionChange != null &&
                                row.positionChange < 0
                              ? 'font-medium text-rose-600'
                              : 'text-zinc-500'
                        }`}
                      >
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
          <div className="rounded-xl border border-[#E8DFD2] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">
              Common technical issues found
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              How many pages have each problem. These are the main reasons the
              Technical SEO score may be low.
            </p>
            <ul className="mt-4 space-y-3">
              {snapshot.appendix.crawlIssues.map((issue) => (
                <li key={issue.code} className="space-y-1">
                  <div className="flex justify-between gap-4 text-sm text-zinc-700">
                    <span>{issueLabel(issue.code, issue.label)}</span>
                    <span className="shrink-0 font-semibold text-[var(--ozer-accent,#FF5C34)] tabular-nums">
                      {issue.count} page{issue.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ozer-accent,#FF5C34)_12%,white)]">
                    <div
                      className="h-full rounded-full bg-[var(--ozer-accent,#FF5C34)]"
                      style={{
                        width: `${Math.round((issue.count / maxIssueCount) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
