'use client';

import { useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  PAGESPEED_CATEGORY_LABELS,
  PAGESPEED_PRIORITY_LABELS,
} from '~/lib/pagespeed/recommendations';
import type {
  PagespeedMetricSet,
  PagespeedRecommendation,
  PagespeedRecommendationCategory,
  PagespeedRecommendationPriority,
} from '~/lib/pagespeed/types';
import { PAGESPEED_RECOMMENDATION_CATEGORIES } from '~/lib/pagespeed/types';

const PRIORITY_COLOURS: Record<PagespeedRecommendationPriority, string> = {
  high: 'bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_18%,transparent)] text-[var(--workspace-shell-text)]',
  medium:
    'bg-[color-mix(in_srgb,#F0C14B_18%,transparent)] text-[var(--workspace-shell-text)]',
  low: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
};

function RecommendationRow({ rec }: { rec: PagespeedRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{rec.title}</span>
          {rec.displayValue ? (
            <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
              {rec.displayValue}
            </span>
          ) : null}
        </span>
        {rec.isQuickWin ? (
          <span className="shrink-0 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200 uppercase">
            Quick win
          </span>
        ) : null}
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase ${PRIORITY_COLOURS[rec.priority]}`}
        >
          {PAGESPEED_PRIORITY_LABELS[rec.priority]}
        </span>
        <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && rec.description ? (
        <div className="border-t border-[color:var(--workspace-shell-border)] px-3 pt-2 pb-3">
          <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
            {rec.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CategoryRecommendations(props: {
  category: PagespeedRecommendationCategory;
  recommendations: PagespeedRecommendation[];
}) {
  const [priorityFilter, setPriorityFilter] = useState<
    'all' | PagespeedRecommendationPriority
  >('all');

  const filtered = useMemo(
    () =>
      props.recommendations.filter(
        (rec) => priorityFilter === 'all' || rec.priority === priorityFilter,
      ),
    [props.recommendations, priorityFilter],
  );

  const counts = useMemo(
    () => ({
      high: props.recommendations.filter((rec) => rec.priority === 'high')
        .length,
      medium: props.recommendations.filter((rec) => rec.priority === 'medium')
        .length,
      low: props.recommendations.filter((rec) => rec.priority === 'low').length,
    }),
    [props.recommendations],
  );

  if (props.recommendations.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No {PAGESPEED_CATEGORY_LABELS[props.category].toLowerCase()} issues —
        looking good.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {props.recommendations.length} item
          {props.recommendations.length === 1 ? '' : 's'}
          {counts.high > 0 ? ` · ${counts.high} high urgency` : ''}
        </p>
        <div className="flex flex-wrap gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`rounded-md px-2 py-1 text-xs capitalize ${
                priorityFilter === filter
                  ? 'ozer-gradient-active text-[var(--ozer-white)]'
                  : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
              onClick={() => setPriorityFilter(filter)}
            >
              {filter === 'all' ? 'All' : PAGESPEED_PRIORITY_LABELS[filter]}
              {filter !== 'all' && counts[filter] > 0
                ? ` (${counts[filter]})`
                : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
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

function StrategyCategoryTabs(props: {
  label: string;
  metrics: PagespeedMetricSet | null;
}) {
  const recommendations = props.metrics?.recommendations ?? [];

  const byCategory = useMemo(() => {
    const grouped = new Map<
      PagespeedRecommendationCategory,
      PagespeedRecommendation[]
    >();

    for (const category of PAGESPEED_RECOMMENDATION_CATEGORIES) {
      grouped.set(category, []);
    }

    for (const rec of recommendations) {
      grouped.get(rec.category)?.push(rec);
    }

    return grouped;
  }, [recommendations]);

  const defaultCategory = useMemo(() => {
    const firstWithItems = PAGESPEED_RECOMMENDATION_CATEGORIES.find(
      (category) => (byCategory.get(category)?.length ?? 0) > 0,
    );
    return firstWithItems ?? 'performance';
  }, [byCategory]);

  if (!props.metrics) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        {props.label} has not been checked yet.
      </p>
    );
  }

  if (props.metrics.errorMsg) {
    return (
      <p className="text-sm text-[var(--ozer-accent-pressed,#C2452A)]">
        {props.label}: {props.metrics.errorMsg}
      </p>
    );
  }

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        {props.label}: no failing audits — looking good.
      </p>
    );
  }

  return (
    <Tabs defaultValue={defaultCategory} className="space-y-3">
      <TabsList className="flex h-auto flex-wrap gap-1 bg-[var(--workspace-control-surface)] p-1">
        {PAGESPEED_RECOMMENDATION_CATEGORIES.map((category) => {
          const count = byCategory.get(category)?.length ?? 0;

          return (
            <TabsTrigger
              key={category}
              value={category}
              className="data-[state=active]:ozer-gradient-active text-xs"
            >
              {PAGESPEED_CATEGORY_LABELS[category]}
              {count > 0 ? ` (${count})` : ''}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {PAGESPEED_RECOMMENDATION_CATEGORIES.map((category) => (
        <TabsContent key={category} value={category} className="mt-0">
          <CategoryRecommendations
            category={category}
            recommendations={byCategory.get(category) ?? []}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function strategyIssueCount(metrics: PagespeedMetricSet | null): number {
  if (!metrics || metrics.errorMsg) return 0;
  return metrics.recommendations.length;
}

export function PagespeedRecommendations(props: {
  mobile: PagespeedMetricSet | null;
  desktop: PagespeedMetricSet | null;
  className?: string;
}) {
  const mobileCount = strategyIssueCount(props.mobile);
  const desktopCount = strategyIssueCount(props.desktop);
  const defaultStrategy =
    mobileCount > 0 || !props.desktop?.recommendations.length
      ? 'mobile'
      : 'desktop';

  if (!props.mobile && !props.desktop) {
    return null;
  }

  if (
    mobileCount === 0 &&
    desktopCount === 0 &&
    !props.mobile?.errorMsg &&
    !props.desktop?.errorMsg &&
    (props.mobile?.resultId || props.desktop?.resultId)
  ) {
    return (
      <div
        className={
          props.className ??
          'border-t border-[color:var(--workspace-shell-border)] px-4 py-4'
        }
      >
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Re-run PageSpeed to import Lighthouse fix recommendations for this
          page.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        props.className ??
        'border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-4'
      }
    >
      <div className="mb-3">
        <h4 className="text-sm font-medium">Lighthouse fixes</h4>
        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
          From Google PageSpeed Insights — grouped by device and category
        </p>
      </div>

      <Tabs defaultValue={defaultStrategy}>
        <TabsList className="mb-4 flex h-auto gap-1 bg-[var(--workspace-control-surface)] p-1">
          <TabsTrigger
            value="mobile"
            className="data-[state=active]:ozer-gradient-active text-xs"
          >
            Mobile
            {mobileCount > 0 ? ` (${mobileCount})` : ''}
          </TabsTrigger>
          <TabsTrigger
            value="desktop"
            className="data-[state=active]:ozer-gradient-active text-xs"
          >
            Desktop
            {desktopCount > 0 ? ` (${desktopCount})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mobile" className="mt-0">
          <StrategyCategoryTabs label="Mobile" metrics={props.mobile} />
        </TabsContent>
        <TabsContent value="desktop" className="mt-0">
          <StrategyCategoryTabs label="Desktop" metrics={props.desktop} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
