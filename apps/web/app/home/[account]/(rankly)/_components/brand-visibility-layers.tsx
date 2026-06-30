'use client';

import { useMemo, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';

import type { PlatformCitationResult, PromptLayer } from '~/lib/ai-audit/types';
import {
  CITATION_SAMPLE_RUNS,
  PROMPT_LAYER_LABELS,
} from '~/lib/ai-audit/types';
import type { BrandVisibilityRow } from '~/lib/site-overview/types';

function SentimentIcon({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const tone =
    pct >= 75
      ? 'text-[var(--keel-teal)]'
      : pct >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  return <span className={`text-sm font-medium tabular-nums ${tone}`}>{pct}%</span>;
}

function BrandVisibilityTable({ rows }: { rows: BrandVisibilityRow[] }) {
  const sampleRuns = rows[0]?.sampleRunsPerPrompt ?? CITATION_SAMPLE_RUNS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">Sampled presence</th>
            <th className="px-3 py-2">Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.platform}-${row.promptLayer ?? 'generic'}`}
              className="border-b border-white/5 last:border-0"
            >
              <td className="px-3 py-3">{row.label}</td>
              <td className="px-3 py-3 text-muted-foreground">
                {row.presenceRatePct ?? row.visibilityPct}% ·{' '}
                {row.promptsChecked ?? row.totalQueries} prompt
                {(row.promptsChecked ?? row.totalQueries) === 1 ? '' : 's'} · {sampleRuns}{' '}
                runs each
              </td>
              <td className="px-3 py-3">
                <SentimentIcon pct={row.sentimentPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditCitationTable({ platforms }: { platforms: PlatformCitationResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2 font-medium">Platform</th>
            <th className="px-4 py-2 font-medium">Presence</th>
            <th className="px-4 py-2 font-medium">Prompts</th>
          </tr>
        </thead>
        <tbody>
          {platforms.map((platform) => (
            <tr
              key={`${platform.platform}-${platform.promptLayer ?? 'generic'}`}
              className="border-b border-white/5 last:border-0 align-top"
            >
              <td className="px-4 py-2 font-medium">{platform.label}</td>
              <td className="px-4 py-2">
                {platform.domainCitedInAny ? (
                  <span className="text-emerald-400">
                    {platform.averagePresenceRate ?? 0}% avg
                  </span>
                ) : (
                  <span className="text-muted-foreground">0% avg</span>
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                <ul className="space-y-1">
                  {platform.citations.map((citation) => (
                    <li key={citation.query}>
                      <span className="text-foreground">{citation.query}</span>
                      {' · '}
                      {citation.presenceRate ?? (citation.domainCited ? 100 : 0)}% (
                      {citation.sampleCount ?? CITATION_SAMPLE_RUNS} runs)
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LayerTabs(props: {
  layer: PromptLayer;
  onLayerChange: (layer: PromptLayer) => void;
}) {
  return (
    <Tabs
      value={props.layer}
      onValueChange={(value) => props.onLayerChange(value as PromptLayer)}
    >
      <TabsList className="h-8">
        <TabsTrigger value="generic" className="text-xs">
          {PROMPT_LAYER_LABELS.generic}
        </TabsTrigger>
        <TabsTrigger value="contextual" className="text-xs">
          {PROMPT_LAYER_LABELS.contextual}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function BrandVisibilityLayerPanel(props: {
  rows: BrandVisibilityRow[];
  emptyHref?: string;
}) {
  const [layer, setLayer] = useState<PromptLayer>('generic');
  const rowsByLayer = useMemo(
    () => ({
      generic: props.rows.filter((row) => (row.promptLayer ?? 'generic') === 'generic'),
      contextual: props.rows.filter((row) => row.promptLayer === 'contextual'),
    }),
    [props.rows],
  );
  const activeRows = rowsByLayer[layer];
  const sampleRuns = props.rows[0]?.sampleRunsPerPrompt ?? CITATION_SAMPLE_RUNS;

  if (props.rows.length === 0) {
    return (
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-muted-foreground">
          Run an AI Search Audit to populate platform-level brand visibility.
        </p>
        {props.emptyHref ? (
          <a
            href={props.emptyHref}
            className="text-primary inline-block underline-offset-4 hover:underline"
          >
            Open AI Search Audit →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LayerTabs layer={layer} onLayerChange={setLayer} />
        <p className="text-muted-foreground text-xs">
          Sampled presence ({sampleRuns} runs per prompt) — not a fixed rank
        </p>
      </div>

      {activeRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No {PROMPT_LAYER_LABELS[layer].toLowerCase()} data yet. Re-run the AI Search Audit after
          filling in project brief settings.
        </p>
      ) : (
        <BrandVisibilityTable rows={activeRows} />
      )}
    </div>
  );
}

export function AuditCitationLayerPanel(props: {
  platforms: PlatformCitationResult[];
}) {
  const [layer, setLayer] = useState<PromptLayer>('generic');
  const platformsByLayer = useMemo(
    () => ({
      generic: props.platforms.filter(
        (platform) => (platform.promptLayer ?? 'generic') === 'generic',
      ),
      contextual: props.platforms.filter(
        (platform) => platform.promptLayer === 'contextual',
      ),
    }),
    [props.platforms],
  );
  const activePlatforms = platformsByLayer[layer];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LayerTabs layer={layer} onLayerChange={setLayer} />
        <p className="text-muted-foreground text-xs">
          Sampled presence ({CITATION_SAMPLE_RUNS} runs per prompt)
        </p>
      </div>

      {activePlatforms.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No {PROMPT_LAYER_LABELS[layer].toLowerCase()} checks in this report.
        </p>
      ) : (
        <AuditCitationTable platforms={activePlatforms} />
      )}
    </div>
  );
}
