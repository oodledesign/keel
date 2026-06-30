'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Copy, RotateCcw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { duplicateCampaign } from '../_lib/server/email-marketing.actions';

export function CampaignRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = (sendAgain: boolean) => {
    startTransition(async () => {
      try {
        const newId = await duplicateCampaign(campaignId);
        toast.success(sendAgain ? 'Campaign duplicated — choose a new audience' : 'Campaign duplicated');
        router.push(`/admin/email-marketing/${newId}/edit`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to duplicate campaign');
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'draft' ? (
        <Button asChild variant="outline" size="sm" className="border-[color:var(--workspace-shell-border)]">
          <Link href={`/admin/email-marketing/${campaignId}/edit`}>Edit</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="sm" className="border-[color:var(--workspace-shell-border)]">
        <Link href={`/admin/email-marketing/${campaignId}`}>View</Link>
      </Button>
      {status === 'sent' || status === 'cancelled' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="border-[color:var(--workspace-shell-border)]"
          onClick={() => handleDuplicate(true)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Send again
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        className="border-[color:var(--workspace-shell-border)]"
        onClick={() => handleDuplicate(false)}
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Duplicate
      </Button>
    </div>
  );
}
