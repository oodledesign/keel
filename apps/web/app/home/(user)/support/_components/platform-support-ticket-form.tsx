'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { createPlatformSupportTicketAction } from '~/lib/support/platform-support.actions';

export function PlatformSupportTicketForm(props: {
  accountOptions: Array<{ id: string; label: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
              accountId: String(form.get('accountId') ?? '') || null,
            });
            toast.success('Support ticket submitted');
            router.push(`/app/support/${result.id}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not submit');
          }
        });
      }}
    >
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
            defaultValue=""
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

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit ticket'}
      </Button>
    </form>
  );
}
