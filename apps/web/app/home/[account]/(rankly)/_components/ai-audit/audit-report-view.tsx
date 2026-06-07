'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  DIMENSION_LABELS,
  type AuditDimension,
  type AuditPriority,
  type AuditRecommendationRow,
  type AuditReportRow,
} from '~/lib/ai-audit/types';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

function scoreColour(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreRing(score: number | null): string {
  if (score == null) return 'ring-white/10';
  if (score >= 75) return 'ring-emerald-500/30';
  if (score >= 50) return 'ring-amber-500/30';
  return 'ring-red-500/30';
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
      className={`rounded-xl border border-white/10 bg-black/30 p-4 ring-1 ${scoreRing(score)}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{icons[dimension]}</span>
        {label}
      </div>
      <div className={`text-3xl font-bold ${scoreColour(score)}`}>
        {score ?? '—'}
        <span className="text-lg font-normal text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

const CATEGORY_COLOURS: Record<AuditDimension, string> = {
  entity: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  content: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  eeat: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  tech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

const PRIORITY_COLOURS: Record<AuditPriority, string> = {
  high: 'bg-red-500/20 text-red-200',
  medium: 'bg-amber-500/20 text-amber-200',
  low: 'bg-white/10 text-muted-foreground',
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
    <div className="rounded-lg border border-white/10 bg-black/20">
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
          <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs uppercase text-cyan-200">
            Quick win
          </span>
        ) : null}
        <span
          className={`rounded px-2 py-0.5 text-xs uppercase ${PRIORITY_COLOURS[rec.priority]}`}
        >
          {rec.priority}
        </span>
        <span className="text-muted-foreground text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
          <p className="text-sm text-muted-foreground">{rec.description}</p>

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
            <div className="rounded-md bg-black/40 p-3">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-emerald-300">
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

          <div className="space-y-1 rounded-md bg-black/30 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Projected impact
            </p>
            {rec.outcome ? (
              <p>
                <span className="text-muted-foreground">Outcome:</span> {rec.outcome}
              </p>
            ) : null}
            {rec.why ? (
              <p>
                <span className="text-muted-foreground">Why:</span> {rec.why}
              </p>
            ) : null}
            {rec.magnitude ? (
              <p>
                <span className="text-muted-foreground">Magnitude:</span> {rec.magnitude}
              </p>
            ) : null}
          </div>

          {rec.example_urls?.length ? (
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Example URLs</p>
              {rec.example_urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-primary hover:underline"
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

  if (hasPlatformData) {
    const citedCount = platforms.filter((p) => p.domainCitedInAny).length;

    return (
      <div className="space-y-3">
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            report.ai_cited
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          }`}
        >
          {report.ai_cited
            ? `Your domain is cited on ${citedCount} of ${platforms.length} AI platforms tested.`
            : `Not cited on any of ${platforms.length} AI platforms tested.`}
          {(report.ai_competing_brands?.length ?? 0) > 0 ? (
            <span className="mt-1 block text-xs opacity-80">
              Competing brands cited instead:{' '}
              {report.ai_competing_brands!.join(', ')}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium">Platform</th>
                <th className="px-4 py-2 font-medium">Cited</th>
                <th className="px-4 py-2 font-medium">Queries</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((platform) => (
                <tr
                  key={platform.platform}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{platform.label}</td>
                  <td className="px-4 py-2">
                    {platform.domainCitedInAny ? (
                      <span className="text-emerald-400">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {platform.citedQueries.length
                      ? platform.citedQueries.join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (report.ai_cited) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Your domain is cited in AI search for:{' '}
        {(report.ai_cited_queries ?? []).join(', ') || 'at least one query'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      Not cited in AI search for tested queries.
      {(report.ai_competing_brands?.length ?? 0) > 0 ? (
        <span className="mt-1 block text-xs text-amber-200/80">
          Competing brands cited instead: {report.ai_competing_brands!.join(', ')}
        </span>
      ) : null}
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
  const [priorityFilter, setPriorityFilter] = useState<
    'all' | AuditPriority
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<AuditDimension | null>(
    null,
  );

  const filtered = recommendations
    .filter((rec) => priorityFilter === 'all' || rec.priority === priorityFilter)
    .filter((rec) => !categoryFilter || rec.dimension === categoryFilter);

  const downloadExport = useCallback(() => {
    window.location.href = `/api/rankly/ai-audit/export/${report.id}`;
  }, [report.id]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">{report.target_domain}</h2>
        <p className="text-sm text-muted-foreground">
          Overall score:{' '}
          <span className={`font-semibold ${scoreColour(report.overall_score)}`}>
            {report.overall_score ?? '—'}/100
          </span>{' '}
          · {new Date(report.created_at).toLocaleDateString()}
        </p>
        {report.executive_summary ? (
          <p className="text-sm text-muted-foreground">{report.executive_summary}</p>
        ) : null}
      </header>

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
                : 'bg-black/30 text-muted-foreground'
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
                  : 'bg-black/30 text-muted-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadExport}>
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
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {reports.map((report) => (
          <li
            key={report.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{report.target_domain}</p>
              <p className="text-xs text-muted-foreground">
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
