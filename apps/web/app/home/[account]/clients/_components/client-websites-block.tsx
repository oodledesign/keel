'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { ExternalLink, Globe } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import {
  WebsiteStackBadge,
  WebsiteStatusBadge,
  externalHref,
} from '../../websites/_components/website-badges';
import { WebsitePortalAccessToggle } from '../../websites/_components/website-portal-access-toggle';
import { listWebsites } from '../../websites/_lib/server/server-actions';
import type { Website } from '../../websites/_lib/server/websites.service';

export function ClientWebsitesBlock({
  accountSlug,
  accountId,
  clientId,
  canEdit = false,
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEdit?: boolean;
}) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebsites = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listWebsites({ accountId, clientId });
      setWebsites(rows);
    } catch {
      setWebsites([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchWebsites();
  }, [fetchWebsites]);

  const newHref = `${pathsConfig.app.accountWebsiteNew.replace(
    '[account]',
    accountSlug,
  )}?clientId=${encodeURIComponent(clientId)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Websites
        </h3>
        <Button asChild size="sm" variant="outline">
          <Link href={newHref}>Add website</Link>
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : websites.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No websites linked to this client. Add one from Websites, or edit an
          existing site and pick this client.
        </p>
      ) : (
        <ul className="space-y-2">
          {websites.map((site) => {
            const detailHref = pathsConfig.app.accountWebsiteDetail
              .replace('[account]', accountSlug)
              .replace('[id]', site.id);
            const liveHref = externalHref(site.domain);
            const cmsHref = externalHref(site.cmsAdminUrl);

            return (
              <li
                key={site.id}
                className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={detailHref}
                      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)] hover:underline"
                    >
                      <Globe className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                      {site.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <WebsiteStatusBadge status={site.status} />
                      <WebsiteStackBadge stack={site.stack} />
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {site.jobId ? 'Plan & build' : 'Managed site'}
                      </span>
                      <WebsitePortalAccessToggle
                        accountId={accountId}
                        websiteId={site.id}
                        hasClient={Boolean(
                          site.clientOrgId || site.linkedClientId,
                        )}
                        initialPortalVisible={site.portalVisible}
                        canManage={canEdit}
                        compact
                        onChanged={(visible) =>
                          setWebsites((current) =>
                            current.map((row) =>
                              row.id === site.id
                                ? { ...row, portalVisible: visible }
                                : row,
                            ),
                          )
                        }
                      />
                    </div>
                    {site.domain ? (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {site.domain}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cmsHref ? (
                      <Button asChild size="sm" variant="ghost">
                        <a
                          href={cmsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          CMS
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                    {liveHref ? (
                      <Button asChild size="sm" variant="ghost">
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Live
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link href={detailHref}>Open</Link>
                    </Button>
                  </div>
                </div>
                {site.hostingNotes ? (
                  <p className="mt-2 text-xs whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                    {site.hostingNotes}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
