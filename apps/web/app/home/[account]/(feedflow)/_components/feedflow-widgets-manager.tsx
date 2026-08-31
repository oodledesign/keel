'use client';

import { useMemo, useState } from 'react';

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
import { copyTextToClipboard } from '~/lib/clipboard';
import {
  buildIframeEmbedSnippet,
  buildScriptEmbedSnippet,
  feedflowFeedJsonUrl,
} from '~/lib/feedflow/embed';
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

export function FeedflowWidgetsManager(props: {
  accountId: string;
  siteOrigin: string;
  socialAccounts: FeedflowSocialAccountRow[];
  widgets: FeedflowWidgetRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [socialId, setSocialId] = useState<string>(
    props.socialAccounts[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const origin =
    props.siteOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : '');

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
        className={`max-w-lg space-y-4 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
      >
        <p className={`text-sm ${workspaceTextMuted}`}>
          Create a widget, then paste the iframe or script snippet on any site.
          Posts are cached — the embed does not call Instagram on each pageview.
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
                {props.socialAccounts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {accountLabel(s)}
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
        <div className="space-y-6">
          {props.widgets.map((widget) => (
            <WidgetEmbedCard
              key={widget.id}
              widget={widget}
              origin={origin}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WidgetEmbedCard(props: {
  widget: FeedflowWidgetRow;
  origin: string;
}) {
  const snippets = useMemo(
    () => ({
      iframe: buildIframeEmbedSnippet(props.origin, props.widget.embed_key),
      script: buildScriptEmbedSnippet(props.origin, props.widget.embed_key),
      json: feedflowFeedJsonUrl(props.origin, props.widget.embed_key),
    }),
    [props.origin, props.widget.embed_key],
  );
  const [copied, setCopied] = useState<'iframe' | 'script' | null>(null);

  const copy = async (kind: 'iframe' | 'script') => {
    try {
      await copyTextToClipboard(snippets[kind]);
      setCopied(kind);
      toast.success('Embed snippet copied');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy snippet');
    }
  };

  return (
    <div
      className={`space-y-4 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-medium ${workspaceText}`}>
            {props.widget.name}
          </h3>
          <p className={`font-mono text-xs ${workspaceTextMuted}`}>
            {props.widget.embed_key}
          </p>
        </div>
        <a
          href={snippets.json}
          className="text-primary text-sm underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          JSON
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>iframe snippet</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => copy('iframe')}>
              {copied === 'iframe' ? 'Copied' : 'Copy iframe'}
            </Button>
          </div>
          <pre
            className={`overflow-x-auto rounded-md border bg-[var(--workspace-control-surface)] p-3 text-xs ${workspaceBorder} ${workspaceText}`}
          >
            <code>{snippets.iframe}</code>
          </pre>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>script snippet</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => copy('script')}>
              {copied === 'script' ? 'Copied' : 'Copy script'}
            </Button>
          </div>
          <pre
            className={`overflow-x-auto rounded-md border bg-[var(--workspace-control-surface)] p-3 text-xs ${workspaceBorder} ${workspaceText}`}
          >
            <code>{snippets.script}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preview</Label>
        <iframe
          title={`${props.widget.name} preview`}
          src={`/api/feedflow/embed?widget=${encodeURIComponent(props.widget.embed_key)}`}
          className={`h-[28rem] w-full rounded-md border bg-white ${workspaceBorder}`}
        />
      </div>
    </div>
  );
}
