'use client';

import { useState, useTransition } from 'react';

import { Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { ApiTokenListItem } from '~/lib/api-tokens/types';
import type { RecorderUsageSummary } from '~/lib/recorder/access';

import {
  createApiTokenAction,
  revokeApiTokenAction,
} from '../_lib/server/api-tokens-actions';

type Props = {
  accountId: string;
  accountSlug?: string;
  scope?: 'personal' | 'workspace';
  initialTokens: ApiTokenListItem[];
  usageSummary?: RecorderUsageSummary | null;
};

function formatWhen(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ApiTokensSettingsCard({
  accountId,
  accountSlug,
  scope = 'workspace',
  initialTokens,
  usageSummary,
}: Props) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a name for this token');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createApiTokenAction({
          accountId,
          accountSlug,
          personal: scope === 'personal',
          name: trimmed,
        });
        setRawToken(result.rawToken);
        setCopied(false);
        setTokens((prev) => [result.token, ...prev]);
        setName('');
        toast.success('API token created');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const revoke = (tokenId: string) => {
    startTransition(async () => {
      try {
        await revokeApiTokenAction({
          accountId,
          accountSlug,
          personal: scope === 'personal',
          tokenId,
        });
        setTokens((prev) =>
          prev.map((token) =>
            token.id === tokenId
              ? { ...token, revoked_at: new Date().toISOString() }
              : token,
          ),
        );
        toast.success('Token revoked');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const copyToken = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    toast.success('Token copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

  return (
    <div className="space-y-5">
      {scope === 'personal' && usageSummary ? (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
          <p>
            Plan:{' '}
            <span className="font-medium text-white">
              {usageSummary.tier === 'standard' ? 'Included with paid workspace' : 'Personal / Business Lite'}
            </span>
          </p>
          <p className="mt-1">
            This month: {formatMinutes(usageSummary.durationSeconds)} of{' '}
            {formatMinutes(usageSummary.limits.maxDurationSecondsPerMonth)} minutes
            recorded.
          </p>
          {usageSummary.tier === 'limited' ? (
            <p className="mt-2 text-xs">
              Personal and Business Lite include 45 minutes per month. Paid
              Business, Community, or Property workspaces include 10 hours.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {scope === 'personal'
          ? 'Connect the Keel desktop recorder with a personal access token. Choose the destination workspace when you sync each recording.'
          : 'Legacy workspace tokens still work. For new setups, create tokens in your personal settings instead.'}
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <Label htmlFor="api-token-name">Token name</Label>
          <Input
            id="api-token-name"
            placeholder="MacBook Pro — Keel Recorder"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={generate} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Generate token
          </Button>
        </div>
      </div>

      {rawToken ? (
        <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
            Save this token now — it will not be shown again
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-3 py-2 text-xs text-white">
              {rawToken}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copyToken}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Store it somewhere safe. You will not be able to view it again after
            you leave this page.
          </p>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {scope === 'personal' ? 'Your tokens' : 'Your tokens in this workspace'}
          </p>
          <ul className="space-y-2">
            {tokens.map((token) => {
              const revoked = Boolean(token.revoked_at);

              return (
                <li
                  key={token.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 py-3 last:border-b-0"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{token.name}</p>
                      {revoked ? (
                        <Badge variant="outline" className="text-xs">
                          Revoked
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatWhen(token.created_at)}
                      {token.last_used_at
                        ? ` · Last used ${formatWhen(token.last_used_at)}`
                        : ''}
                      {token.expires_at
                        ? ` · Expires ${formatWhen(token.expires_at)}`
                        : ''}
                    </p>
                  </div>
                  {!revoked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => revoke(token.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {scope === 'personal' ? 'No tokens yet.' : 'No tokens yet for this workspace.'}
        </p>
      )}
    </div>
  );
}
