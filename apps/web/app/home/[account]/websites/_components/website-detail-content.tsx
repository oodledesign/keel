'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { ExternalLink, Pencil } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import type { PhaseListItem } from '~/home/[account]/jobs/_lib/schema/project-phases.schema';
import type {
  SiteStudioBundle,
  WebsitePlanningTab,
} from '~/lib/websites/planning-types';
import { workspaceBtnPrimaryMd, workspaceLinkAccent } from '~/lib/workspace-ui';

import type { WebsiteApprovalRecord } from '../_lib/server/website-approvals.service';
import type { WebsitePlanningBundle } from '../_lib/server/website-planning.service';
import type { Website } from '../_lib/server/websites.service';
import { SiteStudioAccessProvider } from './site-studio/site-studio-access';
import {
  WebsiteStackBadge,
  WebsiteStatusBadge,
  externalHref,
  formatWebsiteDate,
} from './website-badges';
import { WebsitePlanningPanel } from './website-planning-panel';

function DetailField({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  const display = value?.trim() || '—';

  return (
    <div className="space-y-1">
      <p className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-sm ${workspaceLinkAccent}`}
        >
          {display}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : (
        <p className="text-sm text-[var(--workspace-shell-text)]/80">
          {display}
        </p>
      )}
    </div>
  );
}

export function WebsiteDetailContent({
  website,
  accountSlug,
  accountId,
  canEditWebsites,
  planning,
  siteStudio,
  siteStudioEnabled,
  planningTab,
  linkedJobTitle,
  phases = [],
  approvals = [],
}: {
  website: Website;
  accountSlug: string;
  accountId: string;
  canEditWebsites: boolean;
  planning: WebsitePlanningBundle;
  siteStudio: SiteStudioBundle;
  /** Server-resolved `addon_site_studio` access for the tab shell. */
  siteStudioEnabled: boolean;
  planningTab?: WebsitePlanningTab;
  linkedJobTitle?: string | null;
  phases?: PhaseListItem[];
  approvals?: WebsiteApprovalRecord[];
}) {
  const editHref = pathsConfig.app.accountWebsiteEdit
    .replace('[account]', accountSlug)
    .replace('[id]', website.id);
  const listHref = pathsConfig.app.accountWebsites.replace(
    '[account]',
    accountSlug,
  );
  const liveHref = externalHref(website.domain);
  const cmsHref = externalHref(website.cmsAdminUrl);
  const stagingHref = externalHref(website.stagingUrl);
  const clientHref = website.linkedClientId
    ? `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${website.linkedClientId}`
    : null;
  const [activeTab, setActiveTab] = useState<WebsitePlanningTab>(
    planningTab ?? 'overview',
  );

  useEffect(() => {
    if (planningTab) {
      setActiveTab(planningTab);
    }
  }, [planningTab]);

  const showWebsiteMeta = activeTab === 'overview';

  return (
    <SiteStudioAccessProvider enabled={siteStudioEnabled}>
      <div className="flex w-full flex-col gap-6 px-4 md:px-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Link
              href={listHref}
              className="text-sm text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)]"
            >
              ← Back to websites
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
                {website.name}
              </h1>
              <WebsiteStatusBadge status={website.status} />
              <WebsiteStackBadge stack={website.stack} />
            </div>
            {website.domain ? (
              <p className="text-sm text-[var(--workspace-shell-text)]/60">
                {website.domain}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {cmsHref ? (
              <Button asChild variant="outline">
                <a href={cmsHref} target="_blank" rel="noopener noreferrer">
                  Open CMS
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {liveHref ? (
              <Button asChild className={workspaceBtnPrimaryMd}>
                <a href={liveHref} target="_blank" rel="noopener noreferrer">
                  View live site
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {canEditWebsites ? (
              <Button asChild variant="secondary">
                <Link href={editHref}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <WebsitePlanningPanel
          accountId={accountId}
          accountSlug={accountSlug}
          websiteName={website.name}
          websiteDomain={website.domain}
          websiteStagingUrl={website.stagingUrl}
          websiteStack={website.stack}
          websiteGithubRepoUrl={website.githubRepoUrl}
          planning={planning}
          siteStudio={siteStudio}
          canEdit={canEditWebsites}
          initialTab={planningTab ?? 'overview'}
          onTabChange={setActiveTab}
          linkedJobTitle={linkedJobTitle}
          clientName={website.clientOrgName}
          clientHref={clientHref}
          phases={phases}
          approvals={approvals}
        />

        {showWebsiteMeta ? (
          <>
            <Card className="rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
              <CardHeader>
                <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Domain"
                  value={website.domain}
                  href={liveHref}
                />
                <DetailField
                  label="Staging URL"
                  value={website.stagingUrl}
                  href={stagingHref}
                />
                <DetailField
                  label="Client org"
                  value={website.clientOrgName}
                  href={clientHref}
                />
                <DetailField
                  label="Launched"
                  value={formatWebsiteDate(website.launchedAt)}
                />
                <DetailField
                  label="CMS admin URL"
                  value={website.cmsAdminUrl}
                  href={cmsHref}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
              <CardHeader>
                <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                  Technical details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Stack"
                  value={website.stack.replace('-', ' + ')}
                />
                <DetailField
                  label="Vercel project ID"
                  value={website.vercelProjectId}
                />
                <DetailField
                  label="GitHub repo"
                  value={website.githubRepoUrl}
                  href={website.githubRepoUrl}
                />
                <DetailField
                  label="Supabase schema"
                  value={website.supabaseSchema}
                />
                <DetailField
                  label="Umami website ID"
                  value={website.umamiWebsiteId}
                />
                <DetailField
                  label="Umami share URL"
                  value={website.umamiShareUrl}
                  href={website.umamiShareUrl}
                />
              </CardContent>
            </Card>
          </>
        ) : null}

        {(website.notes || website.hostingNotes) && (
          <Card className="rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {website.notes ? (
                <div>
                  <p className="mb-2 text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                    Notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/80">
                    {website.notes}
                  </p>
                </div>
              ) : null}
              {website.hostingNotes ? (
                <div>
                  <p className="mb-2 text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                    Hosting notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/80">
                    {website.hostingNotes}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {showWebsiteMeta ? (
          <Card className="rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                Timestamps
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <DetailField
                label="Created"
                value={formatWebsiteDate(website.createdAt)}
              />
              <DetailField
                label="Updated"
                value={formatWebsiteDate(website.updatedAt)}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </SiteStudioAccessProvider>
  );
}
