'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Archive, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { BUILDING_SURVEYOR_PIPELINE_LABELS } from '~/lib/building-surveyor/pipeline-stages';
import {
  idleDays,
  selectLeadsToArchive,
} from '~/lib/building-surveyor/surveyor-lead';
import { leadAddressLine } from '~/lib/building-surveyor/surveyor-lead-draft';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { markSurveyorLeadsLostAction } from '../../_lib/server/surveyor-lead-actions';

const SNOOZE_MS = 24 * 60 * 60 * 1000;

function snoozeKey(accountId: string, userId: string | null) {
  return `ozer:surveyor-archive-snooze:${userId ?? 'anon'}:${accountId}`;
}

function isSnoozed(key: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(key) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/**
 * On load, offers to archive Inquiry and Quote sent leads that have been idle
 * for the workspace's archive threshold.
 */
export function SurveyorArchivePrompt({
  deals,
  archiveDays,
  accountId,
  accountSlug,
  currentUserId,
  onArchived,
}: {
  deals: PipelineDeal[];
  archiveDays: number;
  accountId: string;
  accountSlug: string;
  currentUserId: string | null;
  onArchived: (dealIds: string[], lostAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const key = snoozeKey(accountId, currentUserId);

  const idle = useMemo(
    () =>
      selectLeadsToArchive(
        deals.map((deal) => ({
          id: deal.id,
          stage: deal.stage,
          lastActivityAt: deal.surveyorLead?.lastActivityAt ?? null,
          deal,
        })),
        archiveDays,
      ),
    [deals, archiveDays],
  );

  // Checked once per page load; archiving rows should not reopen it.
  useEffect(() => {
    if (checked) return;
    setChecked(true);
    if (idle.length > 0 && !isSnoozed(key)) setOpen(true);
  }, [checked, idle.length, key]);

  useEffect(() => {
    if (open && idle.length === 0) setOpen(false);
  }, [open, idle.length]);

  const archive = (dealIds: string[]) => {
    setPendingId(dealIds.length === 1 ? (dealIds[0] ?? null) : 'all');
    startTransition(async () => {
      try {
        const result = await markSurveyorLeadsLostAction({
          accountId,
          accountSlug,
          dealIds,
          archived: true,
        });
        onArchived(result.updatedIds, result.lostAt);
        toast.success(
          result.updatedIds.length === 1
            ? 'Lead archived'
            : `${result.updatedIds.length} leads archived`,
        );
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setPendingId(null);
      }
    });
  };

  const remindLater = () => {
    try {
      window.localStorage.setItem(key, String(Date.now() + SNOOZE_MS));
    } catch {
      // Private mode: the prompt simply shows again next time.
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : remindLater())}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unresponsive leads</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {idle.length === 1
              ? `This lead has had no activity for ${archiveDays} days or more.`
              : `These ${idle.length} leads have had no activity for ${archiveDays} days or more.`}{' '}
            Archiving moves them to Lost.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
          {idle.map(({ deal }) => (
            <li key={deal.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {deal.contactName || 'Unnamed lead'}
                </p>
                <p className={`truncate text-xs ${workspaceTextMuted}`}>
                  {[
                    BUILDING_SURVEYOR_PIPELINE_LABELS[
                      deal.stage as 'enquiry' | 'quoted'
                    ],
                    leadAddressLine(deal) || deal.companyName,
                    `idle ${idleDays(deal.surveyorLead?.lastActivityAt)} days`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => archive([deal.id])}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] px-2.5 text-xs font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] disabled:opacity-50"
              >
                {pendingId === deal.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                Archive now
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <button
            type="button"
            onClick={remindLater}
            disabled={pending}
            className="h-9 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 text-sm font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Remind me later
          </button>
          <button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={pending || idle.length === 0}
            onClick={() => archive(idle.map(({ id }) => id))}
          >
            {pendingId === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Archive all
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
