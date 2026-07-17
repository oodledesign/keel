'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Lock } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { PhaseListItem } from '~/home/[account]/jobs/_lib/schema/project-phases.schema';
import {
  SITE_STUDIO_PLANNING_TABS,
  type SiteStudioBundle,
  type WebsitePlanningTab,
  type WebsiteSitemapPage,
  type WebsiteStyleTokens,
  type WebsiteWireframePage,
  emptyWebsiteStyleSystem,
} from '~/lib/websites/planning-types';
import { isSiteStudioGatedTab } from '~/lib/websites/site-studio-tabs';

import type { WebsiteApprovalRecord } from '../_lib/server/website-approvals.service';
import type { WebsitePlanningBundle } from '../_lib/server/website-planning.service';
import { useSiteStudioAccess } from './site-studio/site-studio-access';
import { SiteStudioUpsell } from './site-studio/site-studio-upsell';
import { WebsiteApprovalFeed } from './site-studio/website-approval-feed';
import { WebsiteBriefEditor } from './site-studio/website-brief-editor';
import { WebsiteBuildPanel } from './site-studio/website-build-panel';
import { WebsiteDeliveryOverview } from './site-studio/website-delivery-overview';
import { WebsiteDesignEditor } from './site-studio/website-design-editor';
import { WebsiteFigmaPackCard } from './site-studio/website-figma-pack-card';
import { WebsiteOzerSitePanel } from './site-studio/website-ozer-site-panel';
import { WebsitePromptPackCard } from './site-studio/website-prompt-pack-card';
import { WebsiteScaffoldPackCard } from './site-studio/website-scaffold-pack-card';
import { WebsiteSeoEditor } from './site-studio/website-seo-editor';
import { WebsiteSharePanel } from './site-studio/website-share-panel';
import { WebsiteSitemapCanvas } from './site-studio/website-sitemap-canvas';
import { WebsiteContentDocsPanel } from './website-content-docs-panel';
import { WebsiteSitemapEditor } from './website-sitemap-editor';
import { WebsiteWireframeEditor } from './website-wireframe-editor';

const TAB_LABELS: Record<WebsitePlanningTab, string> = {
  overview: 'Overview',
  brief: 'Brief',
  sitemap: 'Sitemap',
  wireframe: 'Wireframes',
  design: 'Design',
  seo: 'Search',
  site: 'Site',
  export: 'Export',
  build: 'Build',
  content: 'Content docs',
};

export function WebsitePlanningPanel({
  accountId,
  accountSlug,
  websiteName: _websiteName,
  websiteDomain,
  websiteStagingUrl = null,
  websiteStack = null,
  websiteGithubRepoUrl = null,
  planning,
  siteStudio,
  canEdit,
  initialTab = 'overview',
  onTabChange,
  linkedJobTitle,
  clientName,
  clientHref,
  phases = [],
  approvals = [],
}: {
  accountId: string;
  accountSlug: string;
  websiteName: string;
  websiteDomain: string | null;
  websiteStagingUrl?: string | null;
  websiteStack?: string | null;
  websiteGithubRepoUrl?: string | null;
  planning: WebsitePlanningBundle;
  siteStudio: SiteStudioBundle;
  canEdit: boolean;
  initialTab?: WebsitePlanningTab;
  onTabChange?: (tab: WebsitePlanningTab) => void;
  linkedJobTitle?: string | null;
  clientName?: string | null;
  clientHref?: string | null;
  phases?: PhaseListItem[];
  approvals?: WebsiteApprovalRecord[];
}) {
  const siteStudioEnabled = useSiteStudioAccess();
  const [forceSiteTab, setForceSiteTab] = useState(
    () => initialTab === 'site' || initialTab === 'build',
  );
  const showSiteTab =
    forceSiteTab ||
    siteStudio.hasOzerSite ||
    siteStudio.brief?.stackPreference === 'ozer_sites';
  const tabs = SITE_STUDIO_PLANNING_TABS.filter(
    (item) => item !== 'site' || showSiteTab,
  );
  const safeInitial = tabs.includes(initialTab) ? initialTab : 'overview';
  const [tab, setTab] = useState<WebsitePlanningTab>(safeInitial);
  const [sitemap, setSitemap] = useState<WebsiteSitemapPage[]>(
    () => planning.sitemap,
  );
  const [wireframes, setWireframes] = useState<WebsiteWireframePage[]>(
    () => planning.wireframes,
  );
  const [styleTokens, setStyleTokens] = useState<WebsiteStyleTokens>(
    () => siteStudio.style?.tokens ?? emptyWebsiteStyleSystem().tokens,
  );

  const jobHref = useMemo(() => {
    if (!planning.jobId) return null;
    return pathsConfig.app.accountJobDetail
      .replace('[account]', accountSlug)
      .replace('[id]', planning.jobId);
  }, [accountSlug, planning.jobId]);

  const locked = !siteStudioEnabled && isSiteStudioGatedTab(tab);

  return (
    <section className="w-full rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Website planning
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/60">
              {siteStudioEnabled
                ? 'Site Studio — brief, sitemap, wireframes, design, search, export, and build.'
                : 'Core planning is free. Brief, Design, Search, Export, and Build unlock with Site Studio.'}
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
            {tabs.map((item) => {
              const gated = isSiteStudioGatedTab(item);
              const itemLocked = gated && !siteStudioEnabled;

              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  aria-disabled={itemLocked || undefined}
                  onClick={() => {
                    setTab(item);
                    onTabChange?.(item);
                  }}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                    tab === item
                      ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                      : 'border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                    itemLocked && tab !== item && 'opacity-70',
                  )}
                >
                  {TAB_LABELS[item]}
                  {itemLocked ? (
                    <Lock className="h-3 w-3 opacity-80" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 px-4 py-5 md:px-6">
        {locked ? (
          <SiteStudioUpsell
            accountSlug={accountSlug}
            lockedTabLabel={TAB_LABELS[tab]}
          />
        ) : null}

        {!locked && tab === 'overview' ? (
          <div className="space-y-6">
            {!siteStudioEnabled ? (
              <SiteStudioUpsell accountSlug={accountSlug} />
            ) : null}

            <WebsiteDeliveryOverview
              accountId={accountId}
              accountSlug={accountSlug}
              websiteId={planning.websiteId}
              clientName={clientName ?? null}
              clientHref={clientHref ?? null}
              jobId={planning.jobId}
              jobTitle={linkedJobTitle ?? null}
              phases={phases}
              canEdit={canEdit}
            />

            {siteStudioEnabled ? (
              <>
                <WebsiteApprovalFeed approvals={approvals} />
                <WebsiteSharePanel
                  accountId={accountId}
                  websiteId={planning.websiteId}
                  accountSlug={accountSlug}
                  shares={siteStudio.shares}
                  portalScope={siteStudio.portalScope}
                  hasJob={Boolean(planning.jobId)}
                  canEdit={canEdit}
                />
              </>
            ) : (
              <div className="space-y-4 text-sm text-[var(--workspace-shell-text)]/75">
                <p>
                  Follow the{' '}
                  <strong className="text-[var(--workspace-shell-text)]">
                    Website design
                  </strong>{' '}
                  project template: Brief → Sitemap → Wireframes → Design → SEO
                  → Export → Build.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {!locked && tab === 'brief' && siteStudioEnabled ? (
          <WebsiteBriefEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            initialBrief={siteStudio.brief}
            initialProvenance={siteStudio.briefProvenance}
            canEdit={canEdit}
          />
        ) : null}

        {/* Keep core editors mounted so edits survive tab switches. */}
        <div className={cn(!locked && tab === 'sitemap' ? 'block' : 'hidden')}>
          {siteStudioEnabled ? (
            <WebsiteSitemapCanvas
              accountId={accountId}
              websiteId={planning.websiteId}
              initialSitemap={sitemap}
              initialComponents={planning.sitemapComponents}
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

        <div
          className={cn(!locked && tab === 'wireframe' ? 'block' : 'hidden')}
        >
          <WebsiteWireframeEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            sitemap={sitemap}
            initialWireframes={wireframes}
            onWireframesChange={setWireframes}
            canEdit={canEdit}
            siteStudioEnabled={siteStudioEnabled}
          />
        </div>

        <div className={cn(!locked && tab === 'design' ? 'block' : 'hidden')}>
          {siteStudioEnabled ? (
            <WebsiteDesignEditor
              accountId={accountId}
              websiteId={planning.websiteId}
              initialStyle={siteStudio.style}
              sitemap={sitemap}
              wireframes={wireframes}
              canEdit={canEdit}
              onStyleChange={setStyleTokens}
            />
          ) : null}
        </div>

        {!locked && tab === 'seo' && siteStudioEnabled ? (
          <WebsiteSeoEditor
            accountId={accountId}
            websiteId={planning.websiteId}
            sitemap={sitemap}
            initialSeoPages={siteStudio.seoPages}
            initialLlmsTxt={siteStudio.llmsTxt}
            canEdit={canEdit}
            stackPreference={siteStudio.brief?.stackPreference ?? 'undecided'}
          />
        ) : null}

        {!locked && tab === 'site' && siteStudioEnabled ? (
          <WebsiteOzerSitePanel
            accountId={accountId}
            websiteId={planning.websiteId}
            accountSlug={accountSlug}
            canEdit={canEdit}
            role="agency"
            liveStyleTokens={styleTokens}
          />
        ) : null}

        {!locked && tab === 'export' && siteStudioEnabled ? (
          <div className="space-y-6">
            <WebsitePromptPackCard
              accountId={accountId}
              websiteId={planning.websiteId}
              defaultTarget={
                siteStudio.brief?.stackPreference === 'webflow' ||
                siteStudio.brief?.stackPreference === 'astro' ||
                siteStudio.brief?.stackPreference === 'next' ||
                siteStudio.brief?.stackPreference === 'ozer_sites'
                  ? siteStudio.brief.stackPreference
                  : 'next'
              }
            />
            <WebsiteScaffoldPackCard
              accountId={accountId}
              websiteId={planning.websiteId}
              kind="webflow"
            />
            <WebsiteScaffoldPackCard
              accountId={accountId}
              websiteId={planning.websiteId}
              kind="astro"
            />
            <WebsiteScaffoldPackCard
              accountId={accountId}
              websiteId={planning.websiteId}
              kind="next"
            />
            <WebsiteFigmaPackCard
              accountId={accountId}
              websiteId={planning.websiteId}
            />
          </div>
        ) : null}

        {!locked && tab === 'build' && siteStudioEnabled ? (
          <WebsiteBuildPanel
            accountSlug={accountSlug}
            websiteId={planning.websiteId}
            domain={websiteDomain}
            stagingUrl={websiteStagingUrl}
            stack={websiteStack}
            githubRepoUrl={websiteGithubRepoUrl}
            stackPreference={siteStudio.brief?.stackPreference}
            hasOzerSite={siteStudio.hasOzerSite}
            canEdit={canEdit}
            onOpenExport={() => setTab('export')}
            onOpenSite={() => {
              setForceSiteTab(true);
              setTab('site');
            }}
          />
        ) : null}

        <div className={cn(!locked && tab === 'content' ? 'block' : 'hidden')}>
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
