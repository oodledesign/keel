'use client';

import Link from 'next/link';

import { ExternalLink, Pencil } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspaceLinkAccent } from '~/lib/workspace-ui';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

import type { WebsitePlanningBundle } from '../_lib/server/website-planning.service';
import type { Website } from '../_lib/server/websites.service';
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
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
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
        <p className="text-sm text-white/80">{display}</p>
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
  planningTab,
}: {
  website: Website;
  accountSlug: string;
  accountId: string;
  canEditWebsites: boolean;
  planning: WebsitePlanningBundle;
  planningTab?: WebsitePlanningTab;
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            href={listHref}
            className="text-sm text-white/50 hover:text-white"
          >
            ← Back to websites
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{website.name}</h1>
            <WebsiteStatusBadge status={website.status} />
            <WebsiteStackBadge stack={website.stack} />
          </div>
          {website.domain ? (
            <p className="text-sm text-white/60">{website.domain}</p>
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
        planning={planning}
        canEdit={canEditWebsites}
        initialTab={planningTab ?? 'overview'}
      />

      <Card className="rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DetailField label="Domain" value={website.domain} href={liveHref} />
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
          <DetailField label="CMS admin URL" value={website.cmsAdminUrl} href={cmsHref} />
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Technical details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DetailField label="Stack" value={website.stack.replace('-', ' + ')} />
          <DetailField label="Vercel project ID" value={website.vercelProjectId} />
          <DetailField label="GitHub repo" value={website.githubRepoUrl} href={website.githubRepoUrl} />
          <DetailField label="Supabase schema" value={website.supabaseSchema} />
          <DetailField label="Umami website ID" value={website.umamiWebsiteId} />
          <DetailField
            label="Umami share URL"
            value={website.umamiShareUrl}
            href={website.umamiShareUrl}
          />
        </CardContent>
      </Card>

      {(website.notes || website.hostingNotes) && (
        <Card className="rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
          <CardHeader>
            <CardTitle className="text-base text-white">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {website.notes ? (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-white/80">
                  {website.notes}
                </p>
              </div>
            ) : null}
            {website.hostingNotes ? (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
                  Hosting notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-white/80">
                  {website.hostingNotes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-base text-white">Timestamps</CardTitle>
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
    </div>
  );
}
