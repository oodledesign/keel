'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

export function PortalNameForm({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required');
      return;
    }

    startTransition(async () => {
      try {
        const client = getSupabaseBrowserClient();
        const { error } = await client
          .from('accounts')
          .update({ name: trimmed })
          .eq('id', userId);

        if (error) throw new Error(error.message);
        toast.success('Name updated');
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not update name',
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label
        htmlFor="portal-display-name"
        className="text-sm text-[var(--ozer-text-on-light)]"
      >
        Display name
      </Label>
      <div className="flex gap-2">
        <Input
          id="portal-display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-[color:var(--workspace-shell-border)]"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}
