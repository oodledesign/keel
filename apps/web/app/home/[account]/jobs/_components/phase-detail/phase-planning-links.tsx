'use client';

import Link from 'next/link';

import { ExternalLink } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

const TAB_LABELS: Record<WebsitePlanningTab, string> = {
  overview: 'Planning overview',
  sitemap: 'Sitemap',
  wireframe: 'Wireframes',
  content: 'Content docs',
};

export function PhasePlanningLinks({
  accountSlug,
  websiteId,
  websiteName,
  planningTab,
}: {
  accountSlug: string;
  websiteId: string;
  websiteName: string;
  planningTab: WebsitePlanningTab | null;
}) {
  const baseHref = pathsConfig.app.accountWebsiteDetail
    .replace('[account]', accountSlug)
    .replace('[id]', websiteId);

  const toolHref =
    planningTab && planningTab !== 'overview'
      ? `${baseHref}?plan=${planningTab}`
      : baseHref;

  return (
    <section className="rounded-xl border border-[var(--keel-teal)]/25 bg-[var(--keel-teal)]/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Website planning</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Linked to {websiteName}
            {planningTab ? ` · open ${TAB_LABELS[planningTab].toLowerCase()}` : ''}
          </p>
        </div>
        <Link
          href={toolHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B132B]/50 px-3 py-1.5 text-sm text-[var(--keel-teal)] hover:bg-white/5"
        >
          {planningTab ? TAB_LABELS[planningTab] : 'Open planning'}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
