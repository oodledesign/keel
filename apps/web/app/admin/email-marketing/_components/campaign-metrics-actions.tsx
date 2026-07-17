'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Copy, Mail, RotateCcw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { duplicateCampaign } from '../_lib/server/email-marketing.actions';

export function CampaignMetricsActions({
  campaignId,
  status,
  subject,
  htmlBody,
  plainTextBody,
  superAdminEmail,
}: {
  campaignId: string;
  status: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string | null;
  superAdminEmail: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copyTo, setCopyTo] = useState(superAdminEmail);

  const handleDuplicate = (sendAgain: boolean) => {
    startTransition(async () => {
      try {
        const newId = await duplicateCampaign(campaignId);
        toast.success(
          sendAgain
            ? 'Campaign duplicated — choose a new audience'
            : 'Campaign duplicated',
        );
        router.push(`/admin/email-marketing/${newId}/edit`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to duplicate campaign',
        );
      }
    });
  };

  const handleSendCopy = () => {
    const to = copyTo.trim();
    if (!to || !/\S+@\S+\.\S+/.test(to)) {
      toast.error('Enter a valid email address');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/email/test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            html: htmlBody,
            text: plainTextBody,
            prefix: 'Copy',
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Failed to send copy');
        }

        toast.success(`Copy sent to ${to}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send copy',
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' ? (
          <Button
            asChild
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
          >
            <Link href={`/admin/email-marketing/${campaignId}/edit`}>
              Edit draft
            </Link>
          </Button>
        ) : null}
        {status === 'sent' || status === 'cancelled' ? (
          <Button
            variant="outline"
            disabled={isPending}
            className="border-[color:var(--workspace-shell-border)]"
            onClick={() => handleDuplicate(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Send again
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={isPending}
          className="border-[color:var(--workspace-shell-border)]"
          onClick={() => handleDuplicate(false)}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </Button>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label className="text-[var(--workspace-shell-text-muted)]">
            Send a copy to
          </Label>
          <Input
            value={copyTo}
            onChange={(event) => setCopyTo(event.target.value)}
            placeholder="you@example.com"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
          />
        </div>
        <Button
          variant="outline"
          disabled={isPending || !copyTo.trim()}
          className="shrink-0 border-[color:var(--workspace-shell-border)]"
          onClick={handleSendCopy}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send a copy
        </Button>
      </div>
    </div>
  );
}
