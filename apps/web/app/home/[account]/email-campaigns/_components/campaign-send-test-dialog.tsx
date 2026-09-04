'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { listAccountMembers } from '~/home/[account]/projects/_lib/server/server-actions';
import {
  CAMPAIGN_TEST_MAX_RECIPIENTS,
  normalizeCampaignTestEmails,
  parseCampaignTestEmailInput,
} from '~/lib/campaigns/campaign-test-send';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

import { sendCampaignTestAction } from '../_lib/server/server-actions';

type TeamMember = {
  user_id: string;
  name: string | null;
  email: string | null;
};

export function CampaignSendTestDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  campaignId,
  onBeforeSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  campaignId: string;
  /** Save draft (and any other prep) before the test send. */
  onBeforeSend?: () => Promise<void>;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualText, setManualText] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingMembers(true);
    listAccountMembers({ accountSlug })
      .then((data) => {
        if (cancelled) return;
        const rows = ((data ?? []) as TeamMember[])
          .map((row) => ({
            user_id: row.user_id,
            name: row.name ?? null,
            email: row.email?.trim() || null,
          }))
          .filter((row) => Boolean(row.email));
        setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          toast.error('Could not load team members');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, accountSlug]);

  const manualEmails = useMemo(
    () => parseCampaignTestEmailInput(manualText),
    [manualText],
  );

  const selectedEmails = useMemo(() => {
    const fromTeam = members
      .filter((member) => member.email && selected.has(member.email.toLowerCase()))
      .map((member) => member.email!.toLowerCase());
    return normalizeCampaignTestEmails([...fromTeam, ...manualEmails]);
  }, [members, selected, manualEmails]);

  const toggleMember = (email: string, checked: boolean) => {
    const key = email.trim().toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const onConfirm = () => {
    if (selectedEmails.length === 0) {
      toast.error('Select a team member or enter an email address');
      return;
    }
    if (selectedEmails.length > CAMPAIGN_TEST_MAX_RECIPIENTS) {
      toast.error(
        `You can send a test to at most ${CAMPAIGN_TEST_MAX_RECIPIENTS} addresses`,
      );
      return;
    }

    startTransition(async () => {
      try {
        await onBeforeSend?.();
        const result = await sendCampaignTestAction({
          accountId,
          accountSlug,
          campaignId,
          emails: selectedEmails,
        });
        if (result.failed > 0) {
          toast.success(
            `Test sent to ${result.sent}; ${result.failed} failed`,
          );
        } else {
          toast.success(
            result.sent === 1
              ? 'Test email sent'
              : `Test emails sent to ${result.sent} addresses`,
          );
        }
        onOpenChange(false);
        setManualText('');
        setSelected(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send test email',
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-test="campaign-send-test-dialog">
        <DialogHeader>
          <DialogTitle>Send test</DialogTitle>
          <DialogDescription className={workspaceTextMuted}>
            Preview the campaign in your inbox. Test sends are free — they do
            not use campaign send units or the subscriber list. Subject is
            prefixed with [Test].
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label className={workspaceText}>Team members</Label>
            {loadingMembers ? (
              <p className={`flex items-center gap-2 text-sm ${workspaceTextMuted}`}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading members…
              </p>
            ) : members.length === 0 ? (
              <p className={`text-sm ${workspaceTextMuted}`}>
                No team members with email addresses found.
              </p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
                {members.map((member) => {
                  const email = member.email!.toLowerCase();
                  const id = `campaign-test-member-${member.user_id}`;
                  return (
                    <li key={member.user_id} className="flex items-start gap-2">
                      <Checkbox
                        id={id}
                        checked={selected.has(email)}
                        disabled={pending}
                        onCheckedChange={(value) =>
                          toggleMember(email, value === true)
                        }
                      />
                      <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
                        <span className={`block truncate font-medium ${workspaceText}`}>
                          {member.name?.trim() || email}
                        </span>
                        {member.name?.trim() ? (
                          <span className={`block truncate text-xs ${workspaceTextMuted}`}>
                            {email}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-test-manual" className={workspaceText}>
              Or enter emails
            </Label>
            <Input
              id="campaign-test-manual"
              data-test="campaign-test-manual-emails"
              placeholder="you@agency.com, colleague@client.com"
              value={manualText}
              disabled={pending}
              onChange={(event) => setManualText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onConfirm();
                }
              }}
            />
            <p className={`text-xs ${workspaceTextMuted}`}>
              Separate with commas or spaces. Merge fields use each recipient’s
              name/email when known.
            </p>
          </div>

          {selectedEmails.length > 0 ? (
            <p className={`text-xs ${workspaceTextMuted}`}>
              Sending to {selectedEmails.length} address
              {selectedEmails.length === 1 ? '' : 'es'}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-test="campaign-send-test-confirm"
            disabled={pending || selectedEmails.length === 0}
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              'Send test'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
