'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ExternalLink, Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { LISTING_STATUS_LABELS } from '~/lib/commercial/commercial-constants';
import type {
  RightmoveBranchAudit,
  RightmoveBranchAuditItem,
} from '~/lib/commercial/rightmove-branch-audit';
import type { RightmoveBranchPropertyKind } from '~/lib/commercial/rightmove-branch-audit-shared';

import {
  auditRightmoveBranchesAction,
  removeRightmoveBranchPropertyAction,
} from '../_lib/server/server-actions';

const KIND_COPY: Record<
  Exclude<RightmoveBranchPropertyKind, 'ozer'>,
  { title: string; detail: string }
> = {
  unknown: {
    title: 'Not in Ozer',
    detail:
      'Live on Rightmove with a reference Ozer has no record of, usually left over from Kato.',
  },
  kato_copy: {
    title: 'Old Kato copies',
    detail:
      'An older copy of an Ozer disposal under its Kato reference. Ozer publishes its own copy, so this one is a duplicate.',
  },
  ozer_off_market: {
    title: 'Should be off Rightmove',
    detail:
      'Published by Ozer, but the disposal is let, sold or withdrawn, or Rightmove was turned off for it.',
  },
};

const REVIEW_KINDS = ['unknown', 'kato_copy', 'ozer_off_market'] as const;

type ItemKey = string;

function itemKey(branchId: number, reference: string): ItemKey {
  return `${branchId}:${reference}`;
}

export function RightmoveBranchAuditCard({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const [audits, setAudits] = useState<RightmoveBranchAudit[] | null>(null);
  const [checking, startChecking] = useTransition();
  const [removing, setRemoving] = useState<Set<ItemKey>>(new Set());
  const [removed, setRemoved] = useState<Set<ItemKey>>(new Set());
  const [armed, setArmed] = useState<ItemKey | null>(null);
  const [confirmKind, setConfirmKind] = useState<
    (typeof REVIEW_KINDS)[number] | null
  >(null);

  const listingHref = (listingId: string) =>
    `${pathsConfig.app.accountListings.replace('[account]', accountSlug)}/${listingId}`;

  const check = () => {
    startChecking(async () => {
      try {
        const result = await auditRightmoveBranchesAction({ accountId });
        setAudits(result.branches);
        setRemoved(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not check Rightmove',
        );
      }
    });
  };

  const pending = useMemo(() => {
    const rows: Array<{
      branch: RightmoveBranchAudit;
      item: RightmoveBranchAuditItem;
    }> = [];
    for (const branch of audits ?? []) {
      for (const item of branch.items) {
        if (!item.removable) continue;
        if (removed.has(itemKey(branch.rightmoveBranchId, item.reference))) {
          continue;
        }
        rows.push({ branch, item });
      }
    }
    return rows;
  }, [audits, removed]);

  async function removeOne(
    branch: RightmoveBranchAudit,
    item: RightmoveBranchAuditItem,
  ): Promise<boolean> {
    const key = itemKey(branch.rightmoveBranchId, item.reference);
    setRemoving((prev) => new Set(prev).add(key));
    try {
      await removeRightmoveBranchPropertyAction({
        accountId,
        rightmoveBranchId: branch.rightmoveBranchId,
        reference: item.reference,
      });
      setRemoved((prev) => new Set(prev).add(key));
      return true;
    } catch (error) {
      toast.error(
        `${item.reference}: ${error instanceof Error ? error.message : 'Remove failed'}`,
      );
      return false;
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function removeKind(kind: (typeof REVIEW_KINDS)[number]) {
    const rows = pending.filter((row) => row.item.kind === kind);
    let ok = 0;
    for (const row of rows) {
      if (await removeOne(row.branch, row.item)) ok++;
    }
    if (ok === rows.length) {
      toast.success(`Removed ${ok} from Rightmove`);
    } else {
      toast.error(`Removed ${ok} of ${rows.length}; the rest failed`);
    }
  }

  const totalLive = (audits ?? []).reduce((n, b) => n + b.items.length, 0);
  const ozerLive = (audits ?? []).reduce(
    (n, b) => n + b.items.filter((i) => i.kind === 'ozer').length,
    0,
  );

  return (
    <div
      className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-4"
      data-test="rightmove-branch-audit"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            What&apos;s live on Rightmove
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            Lists every property Rightmove holds for your branches and finds any
            Ozer doesn&apos;t publish, such as leftovers from Kato, so you can
            remove them.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checking}
          onClick={check}
          data-test="rightmove-branch-audit-check"
        >
          {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {audits ? 'Check again' : 'Check Rightmove'}
        </Button>
      </div>

      {audits && audits.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No offices have a Rightmove Branch ID yet.
        </p>
      ) : null}

      {audits && audits.length > 0 ? (
        <div className="space-y-4">
          <ul className="space-y-1 text-sm text-[var(--workspace-shell-text)]">
            {audits.map((branch) => (
              <li key={branch.rightmoveBranchId}>
                <span className="font-medium">{branch.branchName}</span>{' '}
                <span className="text-[var(--workspace-shell-text-muted)]">
                  ({branch.rightmoveBranchId})
                </span>
                {': '}
                {branch.error ? (
                  <span className="text-rose-500">{branch.error}</span>
                ) : (
                  `${branch.items.length} live on Rightmove`
                )}
                {branch.unreadableSample ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-amber-200/90">
                      Couldn&apos;t read Rightmove&apos;s response. Show it
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-[var(--workspace-shell-sidebar-accent)] p-2 text-xs whitespace-pre-wrap">
                      {branch.unreadableSample}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {ozerLive} of {totalLive} are Ozer disposals that should be live.
            {pending.length === 0
              ? ' Nothing else to clean up.'
              : ` ${pending.length} to review below.`}
          </p>

          {REVIEW_KINDS.map((kind) => {
            const rows = pending.filter((row) => row.item.kind === kind);
            if (rows.length === 0) return null;
            const copy = KIND_COPY[kind];
            return (
              <div key={kind} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {copy.title} ({rows.length})
                    </p>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {copy.detail}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={removing.size > 0}
                    onClick={() => setConfirmKind(kind)}
                  >
                    Remove all {rows.length}
                  </Button>
                </div>
                <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
                  {rows.map(({ branch, item }) => {
                    const key = itemKey(
                      branch.rightmoveBranchId,
                      item.reference,
                    );
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[var(--workspace-shell-text)]">
                            {item.listing ? (
                              <Link
                                href={listingHref(item.listing.id)}
                                className="underline-offset-2 hover:underline"
                              >
                                {item.listing.name}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs">
                                {item.reference}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                            {branch.branchName}
                            {item.listing
                              ? ` · ${
                                  LISTING_STATUS_LABELS[
                                    item.listing
                                      .status as keyof typeof LISTING_STATUS_LABELS
                                  ] ?? item.listing.status
                                } in Ozer · ref ${item.reference}`
                              : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.displayUrl ? (
                            <a
                              href={item.displayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                              aria-label="Open on Rightmove"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={removing.has(key)}
                            onClick={() => {
                              if (armed !== key) {
                                setArmed(key);
                                return;
                              }
                              setArmed(null);
                              void removeOne(branch, item);
                            }}
                            onBlur={() =>
                              setArmed((current) =>
                                current === key ? null : current,
                              )
                            }
                          >
                            {removing.has(key) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : armed === key ? (
                              'Confirm remove'
                            ) : (
                              'Remove'
                            )}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <AlertDialog
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open) setConfirmKind(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Rightmove?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKind
                ? `This takes down all ${
                    pending.filter((row) => row.item.kind === confirmKind)
                      .length
                  } properties listed under “${KIND_COPY[confirmKind].title}”. They can only come back by being published again.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const kind = confirmKind;
                setConfirmKind(null);
                if (kind) void removeKind(kind);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
