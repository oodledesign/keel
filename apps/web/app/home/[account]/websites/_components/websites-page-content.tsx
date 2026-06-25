'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { ExternalLink, Globe, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspaceLinkAccent } from '~/lib/workspace-ui';

import type { Website } from '../_lib/server/websites.service';
import {
  WebsiteStackBadge,
  WebsiteStatusBadge,
  externalHref,
  formatWebsiteDate,
} from './website-badges';

type StatusFilter = 'all' | 'live' | 'in-progress' | 'archived';

const filterTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'archived', label: 'Archived' },
];

export function WebsitesPageContent({
  accountSlug,
  accountId,
  canEditWebsites,
  initialWebsites,
}: {
  accountSlug: string;
  accountId: string;
  canEditWebsites: boolean;
  initialWebsites: Website[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredWebsites = useMemo(() => {
    if (statusFilter === 'all') return initialWebsites;
    return initialWebsites.filter((site) => site.status === statusFilter);
  }, [initialWebsites, statusFilter]);

  const newHref = pathsConfig.app.accountWebsiteNew.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-6 px-4 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Websites</h1>
          <p className="text-sm text-white/50">
            {filteredWebsites.length}{' '}
            {filteredWebsites.length === 1 ? 'website' : 'websites'}
          </p>
        </div>

        {canEditWebsites ? (
          <Button asChild className={workspaceBtnPrimaryMd}>
            <Link href={newHref}>
              <Plus className="h-4 w-4" />
              Add website
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {filterTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--keel-teal)]/15 text-[#5eead4]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredWebsites.length === 0 ? (
        <Card className="rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="mb-4 h-12 w-12 text-white/20" />
            <p className="font-medium text-white">No websites yet</p>
            <p className="mt-1 max-w-md text-sm text-white/50">
              Track client sites, domains, stacks, and launch dates in one place.
            </p>
            {canEditWebsites ? (
              <Button asChild className={`mt-4 ${workspaceBtnPrimaryMd}`}>
                <Link href={newHref}>
                  <Plus className="h-4 w-4" />
                  Add website
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Stack</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Launched</th>
                </tr>
              </thead>
              <tbody>
                {filteredWebsites.map((site) => {
                  const detailHref = pathsConfig.app.accountWebsiteDetail
                    .replace('[account]', accountSlug)
                    .replace('[id]', site.id);
                  const domainHref = externalHref(site.domain);
                  const clientHref =
                    site.linkedClientId &&
                    pathsConfig.app.accountClients
                      .replace('[account]', accountSlug) + `/${site.linkedClientId}`;

                  return (
                    <tr
                      key={site.id}
                      className="border-b border-white/6 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="font-medium text-white hover:text-[#5eead4]"
                        >
                          {site.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {domainHref ? (
                          <a
                            href={domainHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 ${workspaceLinkAccent}`}
                          >
                            {site.domain}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <WebsiteStackBadge stack={site.stack} />
                      </td>
                      <td className="px-4 py-3">
                        <WebsiteStatusBadge status={site.status} />
                      </td>
                      <td className="px-4 py-3">
                        {site.clientOrgName ? (
                          clientHref ? (
                            <Link
                              href={clientHref}
                              className={`${workspaceLinkAccent} hover:underline`}
                            >
                              {site.clientOrgName}
                            </Link>
                          ) : (
                            <span className="text-white/70">{site.clientOrgName}</span>
                          )
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {formatWebsiteDate(site.launchedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <input type="hidden" name="accountId" value={accountId} />
    </div>
  );
}
