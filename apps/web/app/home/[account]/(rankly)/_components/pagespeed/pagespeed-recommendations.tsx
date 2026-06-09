'use client';

import { useMemo, useState } from 'react';

import {
  PAGESPEED_CATEGORY_LABELS,
  PAGESPEED_PRIORITY_LABELS,
} from '~/lib/pagespeed/recommendations';
import type {
  PagespeedMetricSet,
  PagespeedRecommendation,
  PagespeedRecommendationPriority,
} from '~/lib/pagespeed/types';

const PRIORITY_COLOURS: Record<PagespeedRecommendationPriority, string> = {
  high: 'bg-red-500/20 text-red-200',
  medium: 'bg-amber-500/20 text-amber-200',
  low: 'bg-white/10 text-muted-foreground',
};

const CATEGORY_COLOURS: Record<
  PagespeedRecommendation['category'],
  string
> = {
  performance: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  accessibility: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  'best-practices': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  seo: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
};

function RecommendationRow({ rec }: { rec: PagespeedRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{rec.title}</span>
          {rec.displayValue ? (
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {rec.displayValue}
            </span>
          ) : null}
        </span>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase ${CATEGORY_COLOURS[rec.category]}`}
        >
          {PAGESPEED_CATEGORY_LABELS[rec.category]}
        </span>
        {rec.isQuickWin ? (
          <span className="shrink-0 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-200">
            Quick win
          </span>
        ) : null}
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase ${PRIORITY_COLOURS[rec.priority]}`}
        >
          {PAGESPEED_PRIORITY_LABELS[rec.priority]}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && rec.description ? (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {rec.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StrategyRecommendations(props: {
  label: string;
  metrics: PagespeedMetricSet | null;
}) {
  const [priorityFilter, setPriorityFilter] = useState<
    'all' | PagespeedRecommendationPriority
  >('all');

  const recommendations = props.metrics?.recommendations ?? [];

  const filtered = useMemo(
    () =>
      recommendations.filter(
        (rec) => priorityFilter === 'all' || rec.priority === priorityFilter,
      ),
    [recommendations, priorityFilter],
  );

  const counts = useMemo(
    () => ({
      high: recommendations.filter((rec) => rec.priority === 'high').length,
      medium: recommendations.filter((rec) => rec.priority === 'medium').length,
      low: recommendations.filter((rec) => rec.priority === 'low').length,
    }),
    [recommendations],
  );

  if (!props.metrics || props.metrics.errorMsg) {
    return null;
  }

  if (recommendations.length === 0) {
    return (
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          {props.label}: no failing audits — looking good.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">{props.label} fixes</h4>
          <p className="text-muted-foreground text-xs">
            From Google Lighthouse — {recommendations.length} item
            {recommendations.length === 1 ? '' : 's'}
            {counts.high > 0 ? ` · ${counts.high} high urgency` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`rounded-md px-2 py-1 text-xs capitalize ${
                priorityFilter === filter
                  ? 'keel-gradient-active text-white'
                  : 'bg-white/5 text-muted-foreground hover:text-white'
              }`}
              onClick={() => setPriorityFilter(filter)}
            >
              {filter === 'all' ? 'All' : PAGESPEED_PRIORITY_LABELS[filter]}
              {filter !== 'all' && counts[filter] > 0 ? ` (${counts[filter]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No {priorityFilter} priority items.
          </p>
        ) : (
          filtered.map((rec) => (
            <RecommendationRow key={`${rec.auditId}-${rec.title}`} rec={rec} />
          ))
        )}
      </div>
    </div>
  );
}

export function PagespeedRecommendations(props: {
  mobile: PagespeedMetricSet | null;
  desktop: PagespeedMetricSet | null;
}) {
  const hasAny =
    (props.mobile?.recommendations.length ?? 0) > 0 ||
    (props.desktop?.recommendations.length ?? 0) > 0;

  if (!props.mobile && !props.desktop) {
    return null;
  }

  if (
    !hasAny &&
    !props.mobile?.errorMsg &&
    !props.desktop?.errorMsg &&
    (props.mobile?.resultId || props.desktop?.resultId)
  ) {
    return (
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          Re-run PageSpeed to import Lighthouse fix recommendations for this page.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 bg-black/10">
      <StrategyRecommendations label="Mobile" metrics={props.mobile} />
      <StrategyRecommendations label="Desktop" metrics={props.desktop} />
    </div>
  );
}
