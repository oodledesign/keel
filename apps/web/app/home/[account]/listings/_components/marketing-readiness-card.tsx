'use client';

import Link from 'next/link';

import { AlertTriangle, Check, Circle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import {
  type MarketingReadiness,
  getMarketingReadiness,
} from '~/lib/commercial/marketing-readiness';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';

function tabHref(
  accountSlug: string,
  listingId: string,
  tab: 'marketing' | 'media' | 'management' | 'overview',
) {
  const base = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId);
  if (tab === 'overview') return base;
  return `${base}/${tab}`;
}

export function MarketingReadinessCard({
  listing,
  accountSlug,
  media,
  publications,
  readiness: readinessProp,
}: {
  listing: CommercialListing;
  accountSlug: string;
  media?: CommercialListingMedia[];
  publications?: CommercialPortalPublication[];
  readiness?: MarketingReadiness;
}) {
  const readiness =
    readinessProp ??
    getMarketingReadiness({
      listing,
      media,
      publications,
    });

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base text-[var(--workspace-shell-text)]">
          <span>Marketing readiness</span>
          <span
            className={`text-xs font-medium ${
              readiness.ready
                ? 'text-emerald-600'
                : 'text-[var(--workspace-shell-text)]/55'
            }`}
          >
            {readiness.passCount}/{readiness.total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!readiness.ready ? (
          <p className="flex items-start gap-2 text-xs text-[var(--workspace-shell-text)]/60">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            Fix the items below before publishing for a complete portal pack.
          </p>
        ) : (
          <p className="text-xs text-emerald-600">Ready to publish</p>
        )}
        <ul className="space-y-1.5">
          {readiness.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.pass ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/30" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    item.pass
                      ? 'text-[var(--workspace-shell-text)]/70'
                      : 'font-medium text-[var(--workspace-shell-text)]'
                  }
                >
                  {item.label}
                </p>
                {!item.pass && item.hrefTab ? (
                  <Link
                    href={tabHref(accountSlug, listing.id, item.hrefTab)}
                    className="text-xs text-[var(--ozer-accent)] hover:underline"
                  >
                    {item.hint}
                  </Link>
                ) : !item.pass ? (
                  <p className="text-xs text-[var(--workspace-shell-text)]/45">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function confirmPublishIfNotReady(
  readiness: MarketingReadiness,
): boolean {
  if (readiness.ready) return true;
  const missing = readiness.items
    .filter((i) => !i.pass)
    .map((i) => i.label)
    .join(', ');
  return window.confirm(
    `This disposal is not fully marketing-ready (${readiness.passCount}/${readiness.total}). Missing: ${missing}. Continue anyway?`,
  );
}
