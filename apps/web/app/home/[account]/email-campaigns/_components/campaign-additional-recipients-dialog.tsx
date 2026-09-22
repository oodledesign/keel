'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { CampaignAudienceConfig } from '~/lib/campaigns/campaign-audience';
import { filterAdditionalRecipients } from '~/lib/campaigns/campaign-duplicate';
import {
  workspaceBtnPrimary,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { sendCampaignToAdditionalRecipientsAction } from '../_lib/server/server-actions';
import {
  type AudiencePickerOption,
  CampaignAudiencePicker,
} from './campaign-audience-picker';

const EMPTY_AUDIENCE: CampaignAudienceConfig = {
  emails: [],
  clientIds: [],
  contactIds: [],
  listId: null,
};

export function CampaignAdditionalRecipientsDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  campaignId,
  clients,
  contacts,
  alreadySentEmails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  campaignId: string;
  clients: AudiencePickerOption[];
  contacts: AudiencePickerOption[];
  alreadySentEmails: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        {open ? (
          <AdditionalRecipientsForm
            accountId={accountId}
            accountSlug={accountSlug}
            campaignId={campaignId}
            clients={clients}
            contacts={contacts}
            alreadySentEmails={alreadySentEmails}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AdditionalRecipientsForm({
  accountId,
  accountSlug,
  campaignId,
  clients,
  contacts,
  alreadySentEmails,
  onClose,
}: {
  accountId: string;
  accountSlug: string;
  campaignId: string;
  clients: AudiencePickerOption[];
  contacts: AudiencePickerOption[];
  alreadySentEmails: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [audienceConfig, setAudienceConfig] =
    useState<CampaignAudienceConfig>(EMPTY_AUDIENCE);

  const preview = filterAdditionalRecipients({
    emails: audienceConfig.emails ?? [],
    selectedClientIds: audienceConfig.clientIds ?? [],
    selectedContactIds: audienceConfig.contactIds ?? [],
    clients,
    contacts,
    alreadySentEmails,
  });
  const picked =
    (audienceConfig.emails?.length ?? 0) +
    (audienceConfig.clientIds?.length ?? 0) +
    (audienceConfig.contactIds?.length ?? 0);
  const remaining =
    preview.emails.length +
    preview.clientIds.length +
    preview.contactIds.length;

  const createDraft = () => {
    startTransition(async () => {
      try {
        const result = await sendCampaignToAdditionalRecipientsAction({
          accountId,
          accountSlug,
          campaignId,
          audienceConfig,
        });
        toast.success(
          result.skippedAlreadySent > 0
            ? `Draft created. ${result.skippedAlreadySent} ${result.skippedAlreadySent === 1 ? 'person' : 'people'} already emailed ${result.skippedAlreadySent === 1 ? 'was' : 'were'} left off.`
            : 'Draft created — edit the copy, then review and send',
        );
        onClose();
        router.push(
          pathsConfig.app.accountEmailCampaignContent
            .replace('[account]', accountSlug)
            .replace('[campaignId]', result.campaignId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add recipients',
        );
      }
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send to additional recipients</DialogTitle>
        <DialogDescription>
          Creates a new draft using this email. Only the people you add here are
          included — the original list is not emailed again. Anyone already sent
          this campaign is left off. Edit the copy, then review and send.
        </DialogDescription>
      </DialogHeader>

      <CampaignAudiencePicker
        accountId={accountId}
        accountSlug={accountSlug}
        audienceType="custom"
        audienceConfig={audienceConfig}
        estimatedCount={remaining}
        counts={{
          subscriberCount: 0,
          clientCount: clients.length,
          contactCount: contacts.length,
        }}
        clients={clients}
        contacts={contacts}
        disabled={pending}
        lockType="custom"
        embedded
        onChange={(next) => setAudienceConfig(next.audienceConfig)}
      />

      {picked > 0 && remaining === 0 ? (
        <p
          className={`text-sm ${workspaceText}`}
          data-test="campaign-additional-all-sent"
        >
          Those people were already sent this campaign. Add someone new, or use
          Send again to all.
        </p>
      ) : preview.skippedAlreadySent > 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          {preview.skippedAlreadySent} already emailed{' '}
          {preview.skippedAlreadySent === 1 ? 'person is' : 'people are'} left
          off. {remaining.toLocaleString()} new{' '}
          {remaining === 1 ? 'recipient' : 'recipients'}.
        </p>
      ) : remaining > 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          {remaining.toLocaleString()} new{' '}
          {remaining === 1 ? 'recipient' : 'recipients'}.
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={workspaceBtnPrimary}
          disabled={pending || remaining === 0}
          data-test="campaign-additional-recipients-confirm"
          onClick={createDraft}
        >
          {pending ? 'Creating…' : 'Create draft'}
        </Button>
      </DialogFooter>
    </>
  );
}
