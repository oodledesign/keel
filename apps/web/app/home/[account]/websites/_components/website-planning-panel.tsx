'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';
import type { WebsitePlanningBundle } from '../_lib/server/website-planning.service';

import { WebsiteContentDocsPanel } from './website-content-docs-panel';
import { WebsiteSitemapEditor } from './website-sitemap-editor';
import { WebsiteWireframeEditor } from './website-wireframe-editor';

const TABS: Array<{ id: WebsitePlanningTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'wireframe', label: 'Wireframes' },
  { id: 'content', label: 'Content docs' },
];

export function WebsitePlanningPanel({
  accountId,
  accountSlug,
  planning,
  canEdit,
  initialTab = 'overview',
  linkedJobTitle,
}: {
  accountId: string;
  accountSlug: string;
  planning: WebsitePlanningBundle;
  canEdit: boolean;
  initialTab?: WebsitePlanningTab;
  linkedJobTitle?: string | null;
}) {
  const [tab, setTab] = useState<WebsitePlanningTab>(initialTab);

  const jobHref = useMemo(() => {
    if (!planning.jobId) return null;
    return pathsConfig.app.accountJobDetail
      .replace('[account]', accountSlug)
      .replace('[id]', planning.jobId);
  }, [accountSlug, planning.jobId]);

  return (
    <section className="rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
      <div className="border-b border-white/10 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Website planning</h2>
            <p className="mt-1 text-sm text-white/60">
              Sitemap, wireframes, and content docs for this build.
            </p>
          </div>
          {jobHref ? (
            <Link
              href={jobHref}
              className="text-sm text-[var(--keel-teal)] hover:underline"
            >
              Open project{linkedJobTitle ? `: ${linkedJobTitle}` : ''}
            </Link>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-colors',
                tab === item.id
                  ? 'bg-[var(--keel-teal)] text-white'
                  : 'border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 md:px-6">
        {tab === 'overview' ? (
          <div className="space-y-4 text-sm text-white/75">
            <p>
              Follow the <strong className="text-white">Website design</strong>{' '}
              project template in Jobs: business context → sitemap → wireframes →
              client content → design → typography → build.
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-white/70">
              <li>Set visual references before any AI tool.</li>
              <li>Map pages and sections in the sitemap.</li>
              <li>Add layout intent in wireframes.</li>
              <li>Collect real client copy in content docs.</li>
              <li>Lock colour, type, and imagery — then build with visual direction.</li>
            </ol>
            {!planning.jobId ? (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-100/90">
                Tip: link this website to a job in Edit to connect PM phases with
                these planning tools.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === 'sitemap' ? (
          <WebsiteSitemapEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            initialSitemap={planning.sitemap}
            canEdit={canEdit}
          />
        ) : null}

        {tab === 'wireframe' ? (
          <WebsiteWireframeEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            sitemap={planning.sitemap}
            initialWireframes={planning.wireframes}
            canEdit={canEdit}
          />
        ) : null}

        {tab === 'content' ? (
          <WebsiteContentDocsPanel
            accountId={accountId}
            websiteId={planning.websiteId}
            initialDocs={planning.contentDocs}
            canEdit={canEdit}
          />
        ) : null}
      </div>
    </section>
  );
}
