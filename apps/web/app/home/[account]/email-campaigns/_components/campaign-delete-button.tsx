'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { MoreHorizontal, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import { deleteCampaignSeriesAction } from '../_lib/server/campaign-series-actions';
import { deleteCampaignAction } from '../_lib/server/server-actions';

type CampaignDeleteKind = 'campaign' | 'series';

function campaignsListHref(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    accountSlug,
  );
}

function confirmCopy(input: {
  kind: CampaignDeleteKind;
  name: string;
  hadSends: boolean;
}): { title: string; description: string; action: string } {
  if (input.kind === 'series') {
    return {
      title: `Delete “${input.name}”?`,
      description: input.hadSends
        ? 'This permanently deletes the series and any unsent weeks. It will not send again. Emails already sent stay on the Campaigns list with their recipient logs. This cannot be undone.'
        : 'This permanently deletes the series and its scheduled weeks. Nothing has been sent yet. This cannot be undone.',
      action: 'Delete series',
    };
  }

  return {
    title: `Delete “${input.name}”?`,
    description: input.hadSends
      ? 'This permanently deletes the campaign and its send history. Recipient logs and email events for this campaign are removed. This cannot be undone.'
      : 'This permanently deletes the campaign. It will not send. This cannot be undone.',
    action: 'Delete campaign',
  };
}

export function CampaignDeleteButton({
  accountId,
  accountSlug,
  kind,
  id,
  name,
  hadSends,
  sending = false,
  compact = false,
  afterDeleteHref,
}: {
  accountId: string;
  accountSlug: string;
  kind: CampaignDeleteKind;
  id: string;
  name: string;
  hadSends: boolean;
  sending?: boolean;
  compact?: boolean;
  afterDeleteHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const copy = confirmCopy({ kind, name, hadSends });
  const testPrefix =
    kind === 'series' ? 'campaign-series-delete' : 'campaign-delete';

  const runDelete = () => {
    startTransition(async () => {
      try {
        if (kind === 'series') {
          await deleteCampaignSeriesAction({
            accountId,
            accountSlug,
            seriesId: id,
          });
          toast.success('Series deleted');
        } else {
          await deleteCampaignAction({
            accountId,
            accountSlug,
            campaignId: id,
          });
          toast.success('Campaign deleted');
        }
        setOpen(false);
        router.push(afterDeleteHref ?? campaignsListHref(accountSlug));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete',
        );
      }
    });
  };

  return (
    <>
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--workspace-shell-text-muted)]"
              disabled={pending || sending}
              aria-label={copy.action}
              data-test={`${testPrefix}-menu`}
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
            className={`w-48 ${workspaceSelectContentClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem
              className={`${workspaceSelectItemClass} cursor-pointer text-[var(--ozer-coral-600)] focus:text-[var(--ozer-coral-600)]`}
              disabled={sending}
              data-test={`${testPrefix}-menu-item`}
              onSelect={() => {
                if (sending) return;
                setOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {copy.action}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={pending || sending}
          data-test={`${testPrefix}-open`}
          className="text-[var(--ozer-coral-600)]"
          onClick={() => setOpen(true)}
        >
          {copy.action}
        </Button>
      )}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || sending}
              data-test={`${testPrefix}-confirm`}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={(event) => {
                event.preventDefault();
                runDelete();
              }}
            >
              {pending ? 'Deleting…' : copy.action}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
