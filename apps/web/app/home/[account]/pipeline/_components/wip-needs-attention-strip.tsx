'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { ChevronDown, ChevronUp, CircleAlert } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type {
  WipAttentionBucket,
  WipAttentionDigest,
  WipAttentionKind,
} from '~/home/[account]/pipeline/_lib/server/wip-attention.loader';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

type Props = {
  accountSlug: string;
  digest: WipAttentionDigest;
};

function accountPath(accountSlug: string, template: string) {
  return template.replace('[account]', accountSlug);
}

function itemHref(accountSlug: string, path: string) {
  // Loader paths are account-relative suffixes like `/pipeline?...` or `/listings/id`
  if (path.startsWith('/pipeline')) {
    return `${accountPath(accountSlug, pathsConfig.app.accountPipeline)}${path.slice('/pipeline'.length)}`;
  }
  if (path.startsWith('/viewings')) {
    return accountPath(accountSlug, pathsConfig.app.accountViewings);
  }
  if (path.startsWith('/listings/')) {
    const id = path.slice('/listings/'.length).split('?')[0];
    return accountPath(
      accountSlug,
      pathsConfig.app.accountListingDetail,
    ).replace('[id]', id ?? '');
  }
  if (path.startsWith('/listings')) {
    return accountPath(accountSlug, pathsConfig.app.accountListings);
  }
  return accountPath(accountSlug, pathsConfig.app.accountPipeline);
}

const KIND_HINT: Record<WipAttentionKind, string> = {
  action_overdue: 'Next action date has passed',
  instruction_idle: 'No stage/activity for 14+ days',
  enquiry_unactioned: 'Still sitting on Interest',
  viewing_feedback: 'Feedback not captured yet',
  requirement_stale: 'No update for 21+ days',
  interest_stuck: 'Interest not progressed for 7+ days',
  match_opportunities: 'Requirements that fit live stock',
};

export function WipNeedsAttentionStrip({ accountSlug, digest }: Props) {
  const [openKind, setOpenKind] = useState<WipAttentionKind | null>(null);

  const activeBucket: WipAttentionBucket | null = useMemo(() => {
    if (!openKind) return null;
    return digest.buckets.find((b) => b.kind === openKind) ?? null;
  }, [digest.buckets, openKind]);

  if (digest.total === 0 || digest.buckets.length === 0) {
    return (
      <div
        className={`${workspacePanelCard} mx-4 flex items-center gap-2 px-3 py-2.5 md:mx-6 lg:mx-8`}
      >
        <CircleAlert className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/35" />
        <p className={`text-sm ${workspaceTextMuted}`}>
          Nothing urgent on the desk right now
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-2 md:mx-6 lg:mx-8">
      <div
        className={`${workspacePanelCard} flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CircleAlert className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Needs attention
              <span className="ml-1.5 text-[var(--workspace-shell-text)]/55 tabular-nums">
                {digest.total}
              </span>
            </p>
            <p className={`hidden text-xs sm:block ${workspaceTextMuted}`}>
              Overdue actions, idle WIP, enquiries, viewings, and fits
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:justify-end">
          {digest.buckets.map((bucket) => {
            const selected = openKind === bucket.kind;
            return (
              <Button
                key={bucket.kind}
                type="button"
                size="sm"
                variant={selected ? 'default' : 'outline'}
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  setOpenKind((prev) =>
                    prev === bucket.kind ? null : bucket.kind,
                  )
                }
              >
                <span className="truncate">{bucket.label}</span>
                <span className="tabular-nums opacity-80">{bucket.count}</span>
                {selected ? (
                  <ChevronUp className="h-3.5 w-3.5 opacity-70" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {activeBucket ? (
        <div
          className={`${workspacePanelCard} overflow-hidden border-[color:var(--workspace-shell-border)]`}
        >
          <div className="border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {activeBucket.label}
            </p>
            <p className={`text-xs ${workspaceTextMuted}`}>
              {KIND_HINT[activeBucket.kind]}
            </p>
          </div>
          {activeBucket.items.length === 0 ? (
            <p className={`px-3 py-4 text-sm ${workspaceTextMuted}`}>
              Open the linked module to work through these.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {activeBucket.items.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <Link
                    href={itemHref(accountSlug, item.path)}
                    className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {item.title}
                      </p>
                      {item.subtitle ? (
                        <p className={`truncate text-xs ${workspaceTextMuted}`}>
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                    {item.daysAgo != null ? (
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${workspaceTextMuted}`}
                      >
                        {item.daysAgo}d
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
