'use client';

import { useCallback, useState } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { AuditCitationLayerPanel } from '~/home/[account]/(rankly)/_components/brand-visibility-layers';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  type AuditDimension,
  type AuditPriority,
  type AuditRecommendationRow,
  type AuditReportRow,
  DIMENSION_LABELS,
} from '~/lib/ai-audit/types';
import { analyzeCrawlAccess } from '~/lib/crawl/access-summary';

import { CrawlAccessBanner } from '../crawl-access-banner';
import { BacklinkBar, BacklinkSourceNote } from '../shared/backlink-bar';
import { OprBadge } from '../shared/opr-badge';

function scoreColour(score: number | null): string {
  if (score == null) return 'text-[var(--workspace-shell-text-muted)]';
  if (score >= 75) return 'text-[var(--ozer-accent)]';
  if (score >= 50) return 'text-[#F0C14B]';
  return 'text-[var(--ozer-accent-pressed,#C2452A)]';
}

function scoreRing(score: number | null): string {
  if (score == null)
    return 'ring-[color-mix(in_srgb,var(--workspace-shell-border)_80%,transparent)]';
  if (score >= 75)
    return 'ring-[color-mix(in_srgb,var(--ozer-accent)_30%,transparent)]';
  if (score >= 50) return 'ring-[color-mix(in_srgb,#F0C14B_30%,transparent)]';
  return 'ring-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_30%,transparent)]';
}

function DimensionScoreCard({
  dimension,
  score,
  label,
}: {
  dimension: AuditDimension;
  score: number | null;
  label: string;
}) {
  const icons: Record<AuditDimension, string> = {
    entity: '🏷',
    content: '⚡',
    eeat: '🛡',
    tech: '✓',
  };

  return (
    <div
      className={`rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] p-4 ring-1 ${scoreRing(score)}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        <span>{icons[dimension]}</span>
        {label}
      </div>
      <div className={`text-3xl font-bold ${scoreColour(score)}`}>
        {score ?? '—'}
        <span className="text-lg font-normal text-[var(--workspace-shell-text-muted)]">
          /100
        </span>
      </div>
    </div>
  );
}

const CATEGORY_COLOURS: Record<AuditDimension, string> = {
  entity:
    'border-[color-mix(in_srgb,var(--ozer-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--workspace-shell-text)]',
  content:
    'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]',
  eeat: 'border-[color-mix(in_srgb,var(--ozer-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--workspace-shell-text)]',
  tech: 'border-[color-mix(in_srgb,#059669_35%,transparent)] bg-[color-mix(in_srgb,#059669_12%,transparent)] text-[var(--workspace-shell-text)]',
};

const PRIORITY_COLOURS: Record<AuditPriority, string> = {
  high: 'bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_18%,transparent)] text-[var(--workspace-shell-text)]',
  medium:
    'bg-[color-mix(in_srgb,#F0C14B_18%,transparent)] text-[var(--workspace-shell-text)]',
  low: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
};

function RecommendationCard({ rec }: { rec: AuditRecommendationRow }) {
  const [expanded, setExpanded] = useState(false);
  const [snippet, setSnippet] = useState<string | null>(rec.fix_snippet);
  const [loadingFix, setLoadingFix] = useState(false);

  const handleHelpMeFix = async () => {
    setLoadingFix(true);
    try {
      const res = await fetch('/api/rankly/ai-audit/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: rec.id }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { snippet: string } }
        | { ok: false; error: { message: string } };
      if (!json.ok) throw new Error(json.error.message);
      setSnippet(json.data.snippet);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingFix(false);
    }
  };

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="flex-1 text-sm font-medium">{rec.title}</span>
        <span
          className={`rounded border px-2 py-0.5 text-xs uppercase ${CATEGORY_COLOURS[rec.dimension]}`}
        >
          {rec.dimension}
        </span>
        {rec.is_quick_win ? (
          <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200 uppercase">
            Quick win
          </span>
        ) : null}
        <span
          className={`rounded px-2 py-0.5 text-xs uppercase ${PRIORITY_COLOURS[rec.priority]}`}
        >
          {rec.priority}
        </span>
        <span className="text-sm text-[var(--workspace-shell-text-muted)]">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-[color:var(--workspace-shell-border)] px-4 pt-4 pb-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {rec.description}
          </p>

          {!snippet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleHelpMeFix}
              disabled={loadingFix}
            >
              {loadingFix ? 'Generating fix…' : 'Help me fix this'}
            </Button>
          ) : (
            <div className="rounded-md bg-[var(--workspace-control-surface)] p-3">
              <pre className="overflow-x-auto text-xs whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                {snippet}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(snippet);
                  toast.success('Copied');
                }}
              >
                Copy
              </Button>
            </div>
          )}

          <div className="space-y-1 rounded-md bg-[var(--workspace-control-surface)] p-3 text-sm">
            <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Projected impact
            </p>
            {rec.outcome ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Outcome:
                </span>{' '}
                {rec.outcome}
              </p>
            ) : null}
            {rec.why ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Why:
                </span>{' '}
                {rec.why}
              </p>
            ) : null}
            {rec.magnitude ? (
              <p>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  Magnitude:
                </span>{' '}
                {rec.magnitude}
              </p>
            ) : null}
          </div>

          {rec.example_urls?.length ? (
            <div>
              <p className="mb-1 text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                Example URLs
              </p>
              {rec.example_urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary block text-sm hover:underline"
                >
                  {url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AiCitationStatus({ report }: { report: AuditReportRow }) {
  const platforms = report.ai_citations_by_platform ?? [];
  const hasPlatformData = platforms.length > 0;
  const competingBrandsOpr = report.ai_competing_brands_opr ?? [];
  const competitorBacklinks = report.competitor_backlinks ?? {};

  const maxBacklinkCount = Math.max(
    report.referring_domains ?? 0,
    ...competingBrandsOpr.map(
      (brand) =>
        brand.referring_domains ?? competitorBacklinks[brand.domain] ?? 0,
    ),
    1,
  );

  const domainMetrics = (
    <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
      <BacklinkSourceNote />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {report.opr_score != null ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--workspace-shell-text-muted)]">
              Your domain OPR:
            </span>
            <OprBadge
              score={report.opr_score}
              decimal={
                report.opr_decimal != null
                  ? Number(report.opr_decimal)
                  : undefined
              }
            />
          </div>
        ) : null}
        {report.referring_domains != null ? (
          <div className="min-w-[200px] flex-1 space-y-1">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Referring domains
            </p>
            <BacklinkBar
              domain={report.target_domain}
              referringDomains={report.referring_domains}
              maxCount={maxBacklinkCount}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const competingBrandsPanel =
    competingBrandsOpr.length > 0 ? (
      <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
        <p className="text-sm font-medium">Competing brands cited instead</p>
        <ul className="space-y-3 text-sm">
          {competingBrandsOpr.map((brand) => {
            const referringDomains =
              brand.referring_domains ??
              competitorBacklinks[brand.domain] ??
              null;

            return (
              <li key={brand.domain} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{brand.domain}</span>
                  <OprBadge score={brand.opr} decimal={brand.opr_decimal} />
                </div>
                <BacklinkBar
                  domain={brand.domain}
                  referringDomains={referringDomains}
                  maxCount={maxBacklinkCount}
                />
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  if (hasPlatformData) {
    const genericPlatforms = platforms.filter(
      (platform) => (platform.promptLayer ?? 'generic') === 'generic',
    );
    const citedCount = genericPlatforms.filter(
      (p) => p.domainCitedInAny,
    ).length;
    const platformCount = genericPlatforms.length || platforms.length;

    return (
      <div className="space-y-3">
        {domainMetrics}

        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            citedCount > 0
              ? 'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
              : 'border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] text-[var(--workspace-shell-text)]'
          }`}
        >
          {citedCount > 0
            ? `Your domain appeared in ${citedCount} of ${platformCount} category-benchmark checks (sampled).`
            : `Not cited in category-benchmark checks on ${platformCount} platforms tested.`}
        </div>

        {competingBrandsPanel}

        {report.referring_domains != null && report.referring_domains > 0 ? (
          <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
            <p className="text-sm font-medium">Top referring domains</p>
            <ul className="space-y-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {(report.top_referring_domains ?? []).slice(0, 10).map((row) => (
                <li
                  key={row.domain}
                  className="flex justify-between gap-2 tabular-nums"
                >
                  <span>{row.domain}</span>
                  <span>{row.link_count.toLocaleString()} links</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <AuditCitationLayerPanel platforms={platforms} />
      </div>
    );
  }

  if (report.ai_cited) {
    return (
      <div className="space-y-3">
        {domainMetrics}
        <div className="rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
          Your domain is cited in AI search for:{' '}
          {(report.ai_cited_queries ?? []).join(', ') || 'at least one query'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {domainMetrics}
      <div className="rounded-lg border border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
        Not cited in AI search for tested queries.
      </div>
      {competingBrandsPanel}
    </div>
  );
}

export function AuditReportView({
  report,
  recommendations,
}: {
  report: AuditReportRow;
  recommendations: AuditRecommendationRow[];
}) {
  const [priorityFilter, setPriorityFilter] = useState<'all' | AuditPriority>(
    'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<AuditDimension | null>(
    null,
  );

  const filtered = recommendations
    .filter(
      (rec) => priorityFilter === 'all' || rec.priority === priorityFilter,
    )
    .filter((rec) => !categoryFilter || rec.dimension === categoryFilter);

  const downloadExport = useCallback(() => {
    window.location.href = `/api/rankly/ai-audit/export/${report.id}`;
  }, [report.id]);

  const crawlAccess = analyzeCrawlAccess(report.crawl_data?.pages ?? []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">{report.target_domain}</h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Overall score:{' '}
          <span
            className={`font-semibold ${scoreColour(report.overall_score)}`}
          >
            {report.overall_score ?? '—'}/100
          </span>{' '}
          · {new Date(report.created_at).toLocaleDateString()}
          {crawlAccess.severity === 'blocked' ? (
            <span className="text-[var(--ozer-accent-pressed,#C2452A)]">
              {' '}
              · crawl blocked
            </span>
          ) : null}
        </p>
        {report.executive_summary ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {report.executive_summary}
          </p>
        ) : null}
      </header>

      <CrawlAccessBanner summary={crawlAccess} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DimensionScoreCard
          dimension="entity"
          score={report.score_entity}
          label={DIMENSION_LABELS.entity}
        />
        <DimensionScoreCard
          dimension="content"
          score={report.score_content}
          label={DIMENSION_LABELS.content}
        />
        <DimensionScoreCard
          dimension="eeat"
          score={report.score_eeat}
          label={DIMENSION_LABELS.eeat}
        />
        <DimensionScoreCard
          dimension="tech"
          score={report.score_tech}
          label={DIMENSION_LABELS.tech}
        />
      </div>

      <AiCitationStatus report={report} />

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setPriorityFilter(filter)}
            className={`rounded px-3 py-1.5 text-xs font-medium uppercase ${
              priorityFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
            }`}
          >
            {filter}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {(['entity', 'content', 'eeat', 'tech'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setCategoryFilter(categoryFilter === cat ? null : cat)
              }
              className={`rounded px-3 py-1.5 text-xs font-medium uppercase ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadExport}
        >
          Export report
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}

export function AuditReportList({
  reports,
  auditPath,
}: {
  reports: Array<{
    id: string;
    target_domain: string;
    overall_score: number | null;
    created_at: string;
  }>;
  auditPath: string;
}) {
  if (!reports.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Previous audits</h3>
      <ul className="divide-y divide-white/10 rounded-lg border border-[color:var(--workspace-shell-border)]">
        {reports.map((report) => (
          <li
            key={report.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{report.target_domain}</p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {report.overall_score ?? '—'}/100 ·{' '}
                {new Date(report.created_at).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`${auditPath}/${report.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              View
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
