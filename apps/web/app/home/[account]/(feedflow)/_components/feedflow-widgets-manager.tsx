'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
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
import {
  workspaceBorder,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type {
  FeedflowSocialAccountRow,
  FeedflowWidgetRow,
} from '../../_lib/server/feedflow-account-data';
import { createFeedflowWidget } from '../_lib/server/feedflow-module-actions';

function accountLabel(account: FeedflowSocialAccountRow) {
  const platform = account.platform ?? account.provider;
  if (account.username) {
    return `${platform} · @${account.username}`;
  }
  return `${platform} · ${account.external_account_id}`;
}

function layoutLabel(layout: string | null) {
  return layout === 'slider' ? 'Slider' : 'Grid';
}

export function FeedflowWidgetsManager(props: {
  accountId: string;
  accountSlug: string;
  socialAccounts: FeedflowSocialAccountRow[];
  widgets: FeedflowWidgetRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [socialId, setSocialId] = useState<string>(
    props.socialAccounts[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const accountsById = new Map(
    props.socialAccounts.map((account) => [account.id, account]),
  );

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
      toast.success('Widget created');
      setName('');
      setOpen(false);
      if (res.widgetId) {
        router.push(`/app/${props.accountSlug}/widgets/${res.widgetId}`);
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          New widget
        </Button>
      </div>

      {props.widgets.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No widgets yet. Create one to get an embed snippet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {props.widgets.map((widget) => {
            const source = widget.social_account_id
              ? accountsById.get(widget.social_account_id)
              : undefined;
            return (
              <Link
                key={widget.id}
                href={`/app/${props.accountSlug}/widgets/${widget.id}`}
                className={`block space-y-2 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 transition hover:border-[color:var(--ozer-accent)] ${workspaceBorder}`}
              >
                <h3 className={`text-sm font-medium ${workspaceText}`}>
                  {widget.name}
                </h3>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  {layoutLabel(widget.layout)} · {widget.post_count ?? 9} posts
                </p>
                {source ? (
                  <p className={`text-xs ${workspaceTextMuted}`}>
                    {accountLabel(source)}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setName('');
          setOpen(next);
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New widget</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <p className={`text-sm ${workspaceTextMuted}`}>
              Posts are cached. The embed does not call Instagram on each
              pageview.
            </p>
            <div className="space-y-2">
              <Label>Social account</Label>
              {props.socialAccounts.length === 0 ? (
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Connect a social account under Social accounts first.
                </p>
              ) : (
                <Select value={socialId} onValueChange={setSocialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose source" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.socialAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {accountLabel(account)}
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
            <DialogFooter>
              <Button
                type="submit"
                disabled={busy || props.socialAccounts.length === 0}
              >
                {busy ? 'Creating…' : 'Create widget'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
