'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Info } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import pathsConfig from '~/config/paths.config';
import type {
  WipAttentionDigest,
  WipAttentionKind,
} from '~/home/[account]/pipeline/_lib/server/wip-attention.loader';
import { workspaceTextMuted } from '~/lib/workspace-ui';

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

function formatCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

/**
 * Toolbar info icon. Hover explains it, click opens the "needs attention"
 * modal (overdue actions, idle WIP, enquiries, viewings and fits).
 */
export function WipNeedsAttentionButton({ accountSlug, digest }: Props) {
  const [open, setOpen] = useState(false);
  const [pickedKind, setPickedKind] = useState<WipAttentionKind | null>(null);

  const hasItems = digest.total > 0 && digest.buckets.length > 0;

  // Default to the first bucket so the modal opens on something useful.
  const activeBucket =
    digest.buckets.find((bucket) => bucket.kind === pickedKind) ??
    digest.buckets[0] ??
    null;

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={
                hasItems
                  ? `Open needs attention (${digest.total})`
                  : 'Open needs attention'
              }
              data-test="wip-needs-attention-button"
              onClick={() => setOpen(true)}
            >
              <Info className="h-4 w-4" />
              {hasItems ? (
                <span
                  aria-hidden
                  className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ozer-accent)] px-1 text-[10px] leading-none font-semibold text-[var(--ozer-white)] tabular-nums"
                >
                  {formatCount(digest.total)}
                </span>
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open needs attention</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-test="wip-needs-attention-dialog"
          className="max-h-[85vh] gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-xl"
        >
          <DialogHeader className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3 text-left">
            <DialogTitle className="text-base">
              Needs attention
              {hasItems ? (
                <span className="ml-1.5 text-[var(--workspace-shell-text)]/55 tabular-nums">
                  {digest.total}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className={workspaceTextMuted}>
              Overdue actions, idle WIP, enquiries, viewings, and fits
            </DialogDescription>
          </DialogHeader>

          {!hasItems || !activeBucket ? (
            <p
              className={`px-4 py-8 text-center text-sm ${workspaceTextMuted}`}
            >
              Nothing urgent on the desk right now
            </p>
          ) : (
            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap gap-1.5 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
                {digest.buckets.map((bucket) => {
                  const selected = activeBucket.kind === bucket.kind;
                  return (
                    <Button
                      key={bucket.kind}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      aria-pressed={selected}
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setPickedKind(bucket.kind)}
                    >
                      <span className="truncate">{bucket.label}</span>
                      <span className="tabular-nums opacity-80">
                        {bucket.count}
                      </span>
                    </Button>
                  );
                })}
              </div>

              <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-2">
                <p className="text-sm font-medium">{activeBucket.label}</p>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  {KIND_HINT[activeBucket.kind]}
                </p>
              </div>

              <div className="min-h-0 overflow-y-auto">
                {activeBucket.items.length === 0 ? (
                  <p className={`px-4 py-6 text-sm ${workspaceTextMuted}`}>
                    Open the linked module to work through these.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                    {activeBucket.items.map((item) => (
                      <li key={`${item.kind}:${item.id}`}>
                        <Link
                          href={itemHref(accountSlug, item.path)}
                          onClick={() => setOpen(false)}
                          className="flex min-w-0 items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.title}
                            </p>
                            {item.subtitle ? (
                              <p
                                className={`truncate text-xs ${workspaceTextMuted}`}
                              >
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
