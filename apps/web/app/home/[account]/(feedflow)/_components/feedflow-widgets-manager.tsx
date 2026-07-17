'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type {
  FeedflowSocialAccountRow,
  FeedflowWidgetRow,
} from '../../_lib/server/feedflow-account-data';
import { createFeedflowWidget } from '../_lib/server/feedflow-module-actions';

export function FeedflowWidgetsManager(props: {
  accountId: string;
  socialAccounts: FeedflowSocialAccountRow[];
  widgets: FeedflowWidgetRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [socialId, setSocialId] = useState<string>(
    props.socialAccounts[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Widget name is required');
      return;
    }
    if (!socialId) {
      toast.error('Select a connected social account first');
      return;
    }
    setBusy(true);
    try {
      const res = await createFeedflowWidget({
        accountId: props.accountId,
        socialAccountId: socialId,
        name: name.trim(),
      });
      toast.success(
        res.embedKey
          ? `Widget created. Embed key: ${res.embedKey}`
          : 'Widget created',
      );
      setName('');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="max-w-lg space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-4"
      >
        <p className="text-muted-foreground text-sm">
          New widgets get a unique embed key. Use the feed API to load posts for
          embeds.
        </p>
        <div className="space-y-2">
          <Label>Social account</Label>
          {props.socialAccounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Connect a social account under Social accounts first.
            </p>
          ) : (
            <Select value={socialId} onValueChange={setSocialId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose source" />
              </SelectTrigger>
              <SelectContent>
                {props.socialAccounts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {(s.platform ?? s.provider) + ' · ' + s.external_account_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="widget-name">Widget name</Label>
          <Input
            id="widget-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Homepage feed"
          />
        </div>
        <Button
          type="submit"
          disabled={busy || props.socialAccounts.length === 0}
        >
          {busy ? 'Creating…' : 'Create widget'}
        </Button>
      </form>

      {props.widgets.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-muted-foreground border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Embed key</th>
                <th className="px-4 py-3">Feed</th>
              </tr>
            </thead>
            <tbody>
              {props.widgets.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                >
                  <td className="px-4 py-3">{w.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{w.embed_key}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/feedflow/feed?widget=${encodeURIComponent(w.embed_key)}`}
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      JSON
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
