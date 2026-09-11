'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
import { deleteWorkspaceFormSubmissionAction } from '~/home/[account]/forms/_lib/server/server-actions';
import type { CampaignFormSubmissionRow } from '~/lib/campaigns/campaign-form-submissions';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

function formSubmissionsHref(accountSlug: string, formId: string) {
  return `${pathsConfig.app.accountFormDetail
    .replace('[account]', accountSlug)
    .replace('[formId]', formId)}?tab=submissions`;
}

function formatReceivedAt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CampaignFormSubmissions({
  accountId,
  accountSlug,
  campaignId,
  formId,
  formName,
  isRsvp,
  submissions,
}: {
  accountId: string;
  accountSlug: string;
  campaignId: string;
  formId: string;
  formName: string;
  isRsvp: boolean;
  submissions: CampaignFormSubmissionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const noun = isRsvp ? 'RSVP' : 'submission';
  const removeTarget = submissions.find((row) => row.id === removeId) ?? null;

  return (
    <div
      className={`${workspacePanelCard} space-y-4 p-4`}
      data-test="campaign-form-submissions"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`font-semibold ${workspaceText}`}>
            {isRsvp ? 'RSVPs' : 'Form submissions'}
          </h3>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Responses to {formName}. Remove a {noun} here or manage the full
            list on the form.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={formSubmissionsHref(accountSlug, formId)}>Open form</Link>
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No {isRsvp ? 'RSVPs' : 'submissions'} yet.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {submissions.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${workspaceText}`}>
                  {row.contactName?.trim() || row.contactEmail || 'Untitled'}
                </p>
                <p className={`truncate text-xs ${workspaceTextMuted}`}>
                  {row.contactEmail ? `${row.contactEmail} · ` : ''}
                  {formatReceivedAt(row.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[var(--ozer-coral-600)]"
                disabled={pending}
                onClick={() => setRemoveId(row.id)}
                data-test={`campaign-remove-submission-${row.id}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.contactName || removeTarget?.contactEmail
                ? `This deletes the form response from ${removeTarget.contactName || removeTarget.contactEmail}. `
                : 'This deletes the form response. '}
              Linked contacts or pipeline records are not deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              data-test="campaign-confirm-remove-submission"
              onClick={(event) => {
                event.preventDefault();
                if (!removeId) return;
                startTransition(async () => {
                  try {
                    await deleteWorkspaceFormSubmissionAction({
                      accountId,
                      accountSlug,
                      formId,
                      submissionId: removeId,
                      campaignId,
                    });
                    setRemoveId(null);
                    toast.success(
                      isRsvp ? 'RSVP removed' : 'Submission removed',
                    );
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : `Could not remove ${noun}`,
                    );
                  }
                });
              }}
            >
              {pending ? 'Removing…' : `Remove ${noun}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
