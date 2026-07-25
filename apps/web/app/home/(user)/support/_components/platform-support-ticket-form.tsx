'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  type SupportAttachmentItem,
  SupportAttachmentUploader,
} from '~/components/support/support-attachment-uploader';
import { createPlatformSupportTicketAction } from '~/lib/support/platform-support.actions';
import {
  PLATFORM_SUPPORT_CATEGORIES,
  PLATFORM_SUPPORT_CATEGORY_LABELS,
  type PlatformSupportTicketCategory,
} from '~/lib/support/platform-support.types';

export function PlatformSupportTicketForm(props: {
  accountOptions: Array<{ id: string; label: string }>;
  defaultAccountId?: string | null;
  onSuccess?: (result: { id: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const router = useRouter();
  const defaultAccountId = props.defaultAccountId ?? '';

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const result = await createPlatformSupportTicketAction({
              subject: String(form.get('subject') ?? ''),
              body: String(form.get('body') ?? ''),
              category: String(
                form.get('category') ?? 'question',
              ) as PlatformSupportTicketCategory,
              accountId: String(form.get('accountId') ?? '') || null,
              attachments,
            });
            toast.success('Support ticket submitted');
            if (props.onSuccess) {
              props.onSuccess(result);
            } else {
              router.push(`/app/support/${result.id}`);
            }
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : 'Could not submit',
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          required
          defaultValue="question"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          {PLATFORM_SUPPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {PLATFORM_SUPPORT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required maxLength={200} />
      </div>

      {props.accountOptions.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="accountId">Related workspace (optional)</Label>
          <select
            id="accountId"
            name="accountId"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            defaultValue={defaultAccountId}
          >
            <option value="">None</option>
            {props.accountOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="body">How can we help?</Label>
        <Textarea id="body" name="body" required rows={6} maxLength={10000} />
      </div>

      <div className="space-y-2">
        <Label>Screenshots / attachments</Label>
        <SupportAttachmentUploader
          platformSupport
          value={attachments}
          onChange={setAttachments}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit ticket'}
      </Button>
    </form>
  );
}
