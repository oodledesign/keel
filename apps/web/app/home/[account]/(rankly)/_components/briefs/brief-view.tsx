'use client';

import { useCallback, useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type {
  CompetitorPage,
  CompetitorWithOpr,
  ContentBriefRow,
  OutlineItem,
  SerpOrganicResult,
  SuggestedLink,
} from '~/lib/briefs/types';

import { OprBadge } from '../shared/opr-badge';
import { BacklinkBar, BacklinkSourceNote } from '../shared/backlink-bar';

function TemplateTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className="inline-flex rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-xs font-medium capitalize">
      {type.replace(/-/g, ' ')}
    </span>
  );
}

function CompetitorDomainsTable({
  competitors,
  targetReferringDomains,
}: {
  competitors: CompetitorWithOpr[] | null;
  targetReferringDomains: number | null;
}) {
  const rows = competitors ?? [];
  if (!rows.length && targetReferringDomains === null) return null;

  const maxCount = Math.max(
    targetReferringDomains ?? 0,
    ...rows.map((row) => row.referring_domains ?? 0),
    1,
  );

  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Top competitors</h3>
        <BacklinkSourceNote />
      </div>
      {targetReferringDomains !== null ? (
        <div className="space-y-1 border-b border-[color:var(--workspace-shell-border)] pb-3 text-xs">
          <p className="text-muted-foreground">Your domain</p>
          <BacklinkBar
            domain="target"
            referringDomains={targetReferringDomains}
            maxCount={maxCount}
          />
        </div>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 pr-2">Domain</th>
                <th className="pb-2 pr-2">OPR</th>
                <th className="pb-2">Referring domains</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((competitor) => (
                <tr key={competitor.domain} className="border-t border-[color:var(--workspace-shell-border)]">
                  <td className="py-2 pr-2">{competitor.domain}</td>
                  <td className="py-2 pr-2">
                    <OprBadge
                      score={competitor.opr}
                      decimal={competitor.opr_decimal}
                    />
                  </td>
                  <td className="py-2">
                    <BacklinkBar
                      domain={competitor.domain}
                      referringDomains={competitor.referring_domains}
                      maxCount={maxCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SerpBenchmarkTable({
  competitors,
}: {
  competitors: CompetitorPage[] | null;
}) {
  const pages = (competitors ?? []).filter((page) => !page.scrapeFailed);
  if (!pages.length) return null;

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-2">
      <h3 className="text-sm font-semibold">SERP benchmarks</h3>
      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 pr-2">Page</th>
              <th className="pb-2 pr-2">Words</th>
              <th className="pb-2 pr-2">H2s</th>
              <th className="pb-2">Schema</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.url} className="border-t border-[color:var(--workspace-shell-border)]">
                <td className="py-2 pr-2 max-w-[8rem] truncate">{page.title}</td>
                <td className="py-2 pr-2">{page.wordCount}</td>
                <td className="py-2 pr-2">{page.h2s.length}</td>
                <td className="py-2">{page.jsonLdTypes.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AISearchAngle({ brief }: { brief: ContentBriefRow }) {
  if (!brief.ai_cited_brands?.length) {
    return (
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 text-sm text-muted-foreground">
        AI Overview not triggered for this query — monitor for future changes.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-3">
      <h3 className="text-sm font-semibold">AI Search angle</h3>
      <p className="text-sm text-muted-foreground">
        LLMs currently cite:{' '}
        <span className="font-medium text-foreground">
          {brief.ai_cited_brands.join(', ')}
        </span>
      </p>
      <ul className="space-y-1">
        {(brief.ai_search_actions ?? []).map((action, index) => (
          <li key={index} className="flex gap-2 text-sm">
            <span className="text-primary">→</span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InternalLinksTable({ links }: { links: SuggestedLink[] | null }) {
  const rows = links ?? [];
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-3">
      <h3 className="text-sm font-semibold">Internal links to include</h3>
      <div className="overflow-x-auto text-sm">
        <table className="w-full text-left">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2 pr-3">Page</th>
              <th className="pb-2 pr-3">Anchor</th>
              <th className="pb-2">Section</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((link, index) => (
              <tr key={index} className="border-t border-[color:var(--workspace-shell-border)]">
                <td className="py-2 pr-3">{link.from_url}</td>
                <td className="py-2 pr-3">{link.anchor}</td>
                <td className="py-2 text-muted-foreground">{link.target_section}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrafficPotential({ brief }: { brief: ContentBriefRow }) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-2 text-sm">
      <h3 className="font-semibold">Traffic potential</h3>
      <dl className="space-y-1">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Position 1–3</dt>
          <dd>~{brief.traffic_position_1_3 ?? '—'}/mo</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Position 5</dt>
          <dd>~{brief.traffic_position_5 ?? '—'}/mo</dd>
        </div>
      </dl>
    </div>
  );
}

function WordCountPanel({ brief }: { brief: ContentBriefRow }) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-2 text-sm">
      <h3 className="font-semibold">Word count</h3>
      <p className="text-2xl font-semibold">{brief.word_count_target ?? '—'}</p>
      <p className="text-muted-foreground">
        Range {brief.word_count_min ?? '—'}–{brief.word_count_max ?? '—'}
      </p>
      <p className="text-xs text-muted-foreground">
        Competitor avg: {brief.competitor_avg_wc ?? '—'}
      </p>
    </div>
  );
}

function formatBriefMarkdown(brief: ContentBriefRow): string {
  const outline = (brief.outline as OutlineItem[] | null) ?? [];
  const outlineMd = outline
    .map((item) => {
      const prefix = item.level === 'h2' ? '####' : '#####';
      return `${prefix} ${item.text} — ${item.notes}${item.cite ? ` (${item.cite})` : ''}`;
    })
    .join('\n');

  const links = (brief.suggested_links as SuggestedLink[] | null) ?? [];
  const linksMd = links.length
    ? links
        .map(
          (link) =>
            `| ${link.from_url} | ${link.anchor} | ${link.target_section} |`,
        )
        .join('\n')
    : '_None suggested_';

  return `# Content Brief: ${brief.target_keyword}

**Template:** ${brief.template_type ?? '—'} | **Word count:** ${brief.word_count_min ?? '—'}–${brief.word_count_max ?? '—'}

## Meta
**Title options:**
${(brief.title_options ?? []).map((title, i) => `${i + 1}. ${title}`).join('\n')}

**Meta description:** ${brief.suggested_meta_desc ?? '—'}

## Outline
### ${brief.h1 ?? brief.target_keyword}
${outlineMd}

## Content gaps to exploit
${(brief.content_gaps ?? []).map((gap) => `- ${gap}`).join('\n')}

## Keywords
**Primary:** ${brief.primary_keyword ?? brief.target_keyword}
**Secondary:** ${(brief.secondary_keywords ?? []).join(', ')}

## Writer notes
**Angle:** ${brief.angle ?? '—'}
**Tone:** ${brief.tone_notes ?? '—'}
**E-E-A-T:** ${brief.eeat_notes ?? '—'}
**Required assets:** ${brief.required_assets ?? '—'}

## Internal links to include
| Page | Anchor | Section |
${linksMd}

## AI Search
Cited brands: ${(brief.ai_cited_brands ?? []).join(', ') || 'none'}
Actions:
${(brief.ai_search_actions ?? []).map((a) => `- ${a}`).join('\n')}

## Traffic potential
Position 1–3: ~${brief.traffic_position_1_3 ?? '—'}/mo | Position 5: ~${brief.traffic_position_5 ?? '—'}/mo
`;
}

export function BriefExport({ brief }: { brief: ContentBriefRow }) {
  const [copied, setCopied] = useState(false);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatBriefMarkdown(brief));
      setCopied(true);
      toast.success('Brief copied as Markdown');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [brief]);

  const downloadMarkdown = useCallback(() => {
    const blob = new Blob([formatBriefMarkdown(brief)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `brief-${brief.target_keyword.replace(/\s+/g, '-').slice(0, 40)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [brief]);

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copyMarkdown}>
        {copied ? 'Copied' : 'Copy as Markdown'}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={downloadMarkdown}>
        Download .md
      </Button>
    </div>
  );
}

export function BriefView({ brief }: { brief: ContentBriefRow }) {
  const outline = (brief.outline as OutlineItem[] | null) ?? [];
  const serp = (brief.serp_snapshot as SerpOrganicResult[] | null) ?? [];
  const competitors = (brief.competitor_data as CompetitorPage[] | null) ?? [];
  const competitorDomains =
    (brief.competitor_domains as CompetitorWithOpr[] | null) ?? [];
  const links = (brief.suggested_links as SuggestedLink[] | null) ?? [];

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{brief.target_keyword}</h2>
          <TemplateTypeBadge type={brief.template_type} />
        </div>
        {brief.angle ? (
          <p className="text-sm text-muted-foreground">{brief.angle}</p>
        ) : null}
        {brief.template_rationale ? (
          <p className="text-xs text-muted-foreground">{brief.template_rationale}</p>
        ) : null}
      </header>

      <BriefExport brief={brief} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(brief.title_options?.length ?? 0) > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Title options</h3>
              <ol className="list-inside list-decimal space-y-1 text-sm">
                {brief.title_options!.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ol>
              {brief.suggested_meta_desc ? (
                <p className="text-sm text-muted-foreground">
                  Meta: {brief.suggested_meta_desc}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Outline</h3>
            {brief.h1 ? (
              <p className="text-lg font-medium">{brief.h1}</p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {outline.map((item, index) => (
                <li
                  key={`${item.text}-${index}`}
                  className={`rounded-md border border-[color:var(--workspace-shell-border)] bg-black/10 px-3 py-2 ${item.level === 'h3' ? 'ml-4' : ''}`}
                >
                  <p className="font-medium">
                    {item.level.toUpperCase()}: {item.text}
                  </p>
                  <p className="text-muted-foreground">{item.notes}</p>
                  {item.cite ? (
                    <p className="text-xs text-primary">Cite: {item.cite}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {(brief.content_gaps?.length ?? 0) > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Content gaps</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {brief.content_gaps!.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2 text-sm">
            <h3 className="font-semibold">Keywords</h3>
            <p>
              <span className="text-muted-foreground">Primary:</span>{' '}
              {brief.primary_keyword ?? brief.target_keyword}
            </p>
            {(brief.secondary_keywords?.length ?? 0) > 0 ? (
              <p>
                <span className="text-muted-foreground">Secondary:</span>{' '}
                {brief.secondary_keywords!.join(', ')}
              </p>
            ) : null}
          </section>

          <section className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-4 text-sm">
            <h3 className="font-semibold">Writer notes</h3>
            {brief.tone_notes ? (
              <p>
                <span className="text-muted-foreground">Tone:</span>{' '}
                {brief.tone_notes}
              </p>
            ) : null}
            {brief.eeat_notes ? (
              <p>
                <span className="text-muted-foreground">E-E-A-T:</span>{' '}
                {brief.eeat_notes}
              </p>
            ) : null}
            {brief.required_assets ? (
              <p>
                <span className="text-muted-foreground">Assets:</span>{' '}
                {brief.required_assets}
              </p>
            ) : null}
          </section>

          <InternalLinksTable links={links} />
          <AISearchAngle brief={brief} />
        </div>

        <div className="space-y-4">
          <TrafficPotential brief={brief} />
          <WordCountPanel brief={brief} />
          <CompetitorDomainsTable
            competitors={competitorDomains}
            targetReferringDomains={brief.target_referring_domains}
          />
          <SerpBenchmarkTable competitors={competitors} />
          {serp.length > 0 ? (
            <div className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4 space-y-2 text-xs">
              <h3 className="text-sm font-semibold">SERP top 10</h3>
              <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                {serp.map((result) => (
                  <li key={result.url} className="truncate">
                    {result.title}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
