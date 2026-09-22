'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, MoreHorizontal, Send, Trash2, UserPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import {
  duplicateCampaignAction,
  duplicateCampaignForResendAction,
} from '../_lib/server/server-actions';
import { CampaignAdditionalRecipientsDialog } from './campaign-additional-recipients-dialog';
import type { AudiencePickerOption } from './campaign-audience-picker';
import { CampaignDeleteButton } from './campaign-delete-button';
import {
  CampaignResendConfirmDialog,
  type ResendMode,
} from './campaign-resend-actions';

type DeleteTarget = {
  kind: 'campaign' | 'series';
  id: string;
  name: string;
  hadSends: boolean;
  sending: boolean;
};

export function CampaignActionsMenu({
  accountId,
  accountSlug,
  campaign,
  placement,
  deleteTarget,
  hasRsvpForm = false,
  clients = [],
  contacts = [],
  alreadySentEmails = [],
}: {
  accountId: string;
  accountSlug: string;
  campaign: Pick<EmailCampaign, 'id' | 'name' | 'status' | 'seriesId'>;
  placement: 'list' | 'detail';
  deleteTarget: DeleteTarget;
  hasRsvpForm?: boolean;
  clients?: AudiencePickerOption[];
  contacts?: AudiencePickerOption[];
  alreadySentEmails?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resendMode, setResendMode] = useState<ResendMode | null>(null);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const canFollowUp =
    placement === 'detail' &&
    (campaign.status === 'sent' || campaign.status === 'failed');
  const deleteLabel =
    deleteTarget.kind === 'series' ? 'Delete series' : 'Delete campaign';

  const duplicate = () => {
    startTransition(async () => {
      try {
        const result = await duplicateCampaignAction({
          accountId,
          accountSlug,
          campaignId: campaign.id,
        });
        toast.success('Draft created from a copy of this campaign');
        router.push(
          pathsConfig.app.accountEmailCampaignDetail
            .replace('[account]', accountSlug)
            .replace('[campaignId]', result.campaignId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not duplicate',
        );
      }
    });
  };

  const resend = (mode: ResendMode) => {
    startTransition(async () => {
      try {
        const result = await duplicateCampaignForResendAction({
          accountId,
          accountSlug,
          campaignId: campaign.id,
          mode,
        });
        toast.success('Draft created — edit the copy, then review and send');
        setResendMode(null);
        router.push(
          pathsConfig.app.accountEmailCampaignContent
            .replace('[account]', accountSlug)
            .replace('[campaignId]', result.campaignId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create follow-up',
        );
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)]"
            disabled={pending}
            aria-label="Campaign actions"
            data-test={
              placement === 'list'
                ? 'campaign-delete-menu'
                : 'campaign-detail-actions-menu'
            }
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={`w-64 ${workspaceSelectContentClass}`}
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            className={`${workspaceSelectItemClass} cursor-pointer`}
            disabled={pending}
            data-test="campaign-duplicate"
            onSelect={() => duplicate()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          {canFollowUp ? (
            <>
              <DropdownMenuSeparator className="bg-[var(--workspace-shell-border)]" />
              <DropdownMenuItem
                className={`${workspaceSelectItemClass} cursor-pointer`}
                disabled={pending}
                data-test="campaign-resend-all-menu"
                onSelect={() => setResendMode('all')}
              >
                <Send className="mr-2 h-4 w-4" />
                Send again to all
              </DropdownMenuItem>
              {hasRsvpForm ? (
                <DropdownMenuItem
                  className={`${workspaceSelectItemClass} cursor-pointer`}
                  disabled={pending}
                  data-test="campaign-resend-non-responders-menu"
                  onSelect={() => setResendMode('non_responders')}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send to non-responders
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className={`${workspaceSelectItemClass} cursor-pointer`}
                disabled={pending}
                data-test="campaign-additional-recipients-menu"
                onSelect={() => setAdditionalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Send to additional recipients
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator className="bg-[var(--workspace-shell-border)]" />
          <DropdownMenuItem
            className={`${workspaceSelectItemClass} cursor-pointer text-[var(--ozer-coral-600)] focus:text-[var(--ozer-coral-600)]`}
            disabled={pending || deleteTarget.sending}
            data-test={
              deleteTarget.kind === 'series'
                ? 'campaign-series-delete-menu-item'
                : 'campaign-delete-menu-item'
            }
            onSelect={() => {
              if (deleteTarget.sending) return;
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CampaignDeleteButton
        hideTrigger
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        kind={deleteTarget.kind}
        id={deleteTarget.id}
        name={deleteTarget.name}
        hadSends={deleteTarget.hadSends}
        sending={deleteTarget.sending}
      />
      {canFollowUp ? (
        <>
          <CampaignResendConfirmDialog
            mode={resendMode}
            pending={pending}
            isSeriesInstance={Boolean(campaign.seriesId)}
            onOpenChange={(open) => {
              if (!pending && !open) setResendMode(null);
            }}
            onConfirm={resend}
            confirmTestId="campaign-resend-confirm-menu"
          />
          <CampaignAdditionalRecipientsDialog
            open={additionalOpen}
            onOpenChange={setAdditionalOpen}
            accountId={accountId}
            accountSlug={accountSlug}
            campaignId={campaign.id}
            clients={clients}
            contacts={contacts}
            alreadySentEmails={alreadySentEmails}
          />
        </>
      ) : null}
    </>
  );
}
