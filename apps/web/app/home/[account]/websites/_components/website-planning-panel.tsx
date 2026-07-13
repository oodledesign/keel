'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  CORE_PLANNING_TABS,
  SITE_STUDIO_PLANNING_TABS,
  type SiteStudioBundle,
  type WebsitePlanningTab,
  type WebsiteSitemapPage,
  type WebsiteWireframePage,
} from '~/lib/websites/planning-types';

import type { WebsitePlanningBundle } from '../_lib/server/website-planning.service';

import { WebsiteContentDocsPanel } from './website-content-docs-panel';
import { WebsiteSitemapEditor } from './website-sitemap-editor';
import { WebsiteWireframeEditor } from './website-wireframe-editor';
import { WebsiteBriefEditor } from './site-studio/website-brief-editor';
import { WebsiteDesignEditor } from './site-studio/website-design-editor';
import { WebsiteExportPanel } from './site-studio/website-export-panel';
import { WebsiteSeoEditor } from './site-studio/website-seo-editor';
import { WebsiteSharePanel } from './site-studio/website-share-panel';
import { WebsiteSitemapCanvas } from './site-studio/website-sitemap-canvas';
import { SiteStudioUpsell } from './site-studio/site-studio-upsell';

const TAB_LABELS: Record<WebsitePlanningTab, string> = {
  overview: 'Overview',
  brief: 'Brief',
  sitemap: 'Sitemap',
  wireframe: 'Wireframes',
  design: 'Design',
  seo: 'Search',
  export: 'Export',
  content: 'Content docs',
};

export function WebsitePlanningPanel({
  accountId,
  accountSlug,
  websiteName,
  websiteDomain,
  planning,
  siteStudio,
  canEdit,
  initialTab = 'overview',
  linkedJobTitle,
}: {
  accountId: string;
  accountSlug: string;
  websiteName: string;
  websiteDomain: string | null;
  planning: WebsitePlanningBundle;
  siteStudio: SiteStudioBundle;
  canEdit: boolean;
  initialTab?: WebsitePlanningTab;
  linkedJobTitle?: string | null;
}) {
  const tabs = siteStudio.enabled
    ? SITE_STUDIO_PLANNING_TABS
    : CORE_PLANNING_TABS;

  const safeInitial = tabs.includes(initialTab) ? initialTab : 'overview';
  const [tab, setTab] = useState<WebsitePlanningTab>(safeInitial);
  // Lifted so sitemap/wireframes survive tab switches (children unmount otherwise).
  const [sitemap, setSitemap] = useState<WebsiteSitemapPage[]>(
    () => planning.sitemap,
  );
  const [wireframes, setWireframes] = useState<WebsiteWireframePage[]>(
    () => planning.wireframes,
  );

  const jobHref = useMemo(() => {
    if (!planning.jobId) return null;
    return pathsConfig.app.accountJobDetail
      .replace('[account]', accountSlug)
      .replace('[id]', planning.jobId);
  }, [accountSlug, planning.jobId]);

  return (
    <section className="w-full rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Website planning
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/60">
              {siteStudio.enabled
                ? 'Site Studio — brief, canvas sitemap, wireframes, design, SEO, and export.'
                : 'Sitemap, wireframes, and content docs for this build.'}
            </p>
          </div>
          {jobHref ? (
            <Link
              href={jobHref}
              className="text-sm text-[var(--ozer-accent)] hover:underline"
            >
              Open project{linkedJobTitle ? `: ${linkedJobTitle}` : ''}
            </Link>
          ) : null}
        </div>

        <div className="-mx-4 mt-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
          <div
            className="flex min-w-full gap-2 pb-0.5"
            role="tablist"
            aria-label="Website planning tabs"
          >
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
                  tab === item
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {TAB_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 px-4 py-5 md:px-6">
        {tab === 'overview' ? (
          <div className="space-y-6">
            {!siteStudio.enabled ? <SiteStudioUpsell accountSlug={accountSlug} /> : null}

            {siteStudio.enabled ? (
              <WebsiteSharePanel
                accountId={accountId}
                websiteId={planning.websiteId}
                accountSlug={accountSlug}
                shares={siteStudio.shares}
                portalScope={siteStudio.portalScope}
                hasJob={Boolean(planning.jobId)}
                canEdit={canEdit}
              />
            ) : (
              <div className="space-y-4 text-sm text-[var(--workspace-shell-text)]/75">
                <p>
                  Follow the <strong className="text-[var(--workspace-shell-text)]">Website design</strong>{' '}
                  project template: business context → sitemap → wireframes →
                  client content → design → build.
                </p>
                {!planning.jobId ? (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-100/90">
                    Tip: link this website to a project in Edit, or add Site
                    Studio to create a delivery project from the Overview tab.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {tab === 'brief' && siteStudio.enabled ? (
          <WebsiteBriefEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            initialBrief={siteStudio.brief}
            canEdit={canEdit}
          />
        ) : null}

        {/* Keep sitemap + wireframes mounted so autosave and local edits survive tab switches. */}
        <div className={cn(tab === 'sitemap' ? 'block' : 'hidden')}>
          {siteStudio.enabled ? (
            <WebsiteSitemapCanvas
              accountId={accountId}
              websiteId={planning.websiteId}
              initialSitemap={sitemap}
              onSitemapChange={setSitemap}
              canEdit={canEdit}
              siteStudioEnabled
            />
          ) : (
            <WebsiteSitemapEditor
              accountId={accountId}
              websiteId={planning.websiteId}
              initialSitemap={sitemap}
              onSitemapChange={setSitemap}
              canEdit={canEdit}
            />
          )}
        </div>

        <div className={cn(tab === 'wireframe' ? 'block' : 'hidden')}>
          <WebsiteWireframeEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            sitemap={sitemap}
            initialWireframes={wireframes}
            onWireframesChange={setWireframes}
            canEdit={canEdit}
            siteStudioEnabled={siteStudio.enabled}
          />
        </div>

        {tab === 'design' && siteStudio.enabled ? (
          <WebsiteDesignEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            initialStyle={siteStudio.style}
            canEdit={canEdit}
          />
        ) : null}

        {tab === 'seo' && siteStudio.enabled ? (
          <WebsiteSeoEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            sitemap={sitemap}
            initialSeoPages={siteStudio.seoPages}
            canEdit={canEdit}
          />
        ) : null}

        {tab === 'export' && siteStudio.enabled ? (
          <WebsiteExportPanel
            websiteName={websiteName}
            domain={websiteDomain}
            brief={siteStudio.brief}
            sitemap={sitemap}
            wireframes={wireframes}
            style={siteStudio.style}
            seoPages={siteStudio.seoPages}
          />
        ) : null}

        <div className={cn(tab === 'content' ? 'block' : 'hidden')}>
          <WebsiteContentDocsPanel
            accountId={accountId}
            websiteId={planning.websiteId}
            initialDocs={planning.contentDocs}
            canEdit={canEdit}
          />
        </div>
      </div>
    </section>
  );
}
