'use client';

import { useState, useTransition } from 'react';

import type { z } from 'zod';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import type { IgTriggerRow } from '~/lib/instagram-autoreply/types';

import type { upsertIgTriggerActionSchema } from '../_lib/schema/instagram-autoreply.schema';

type UpsertIgTriggerInput = z.infer<typeof upsertIgTriggerActionSchema>;

type InstagramTriggerEditorProps = {
  accountId: string;
  trigger: Partial<IgTriggerRow> | null;
  onSave: (input: UpsertIgTriggerInput) => Promise<{ ok: boolean }>;
};

export function InstagramTriggerEditor({
  accountId,
  trigger,
  onSave,
}: InstagramTriggerEditorProps) {
  const [name, setName] = useState(trigger?.name ?? '');
  const [keywordsText, setKeywordsText] = useState(
    (trigger?.keywords ?? []).join(', '),
  );
  const [matchType, setMatchType] = useState(trigger?.match_type ?? 'contains');
  const [publicEnabled, setPublicEnabled] = useState(
    trigger?.public_reply_enabled ?? true,
  );
  const [publicMode, setPublicMode] = useState(
    trigger?.public_reply_mode ?? 'static',
  );
  const [publicTemplate, setPublicTemplate] = useState(
    trigger?.public_reply_template ?? '',
  );
  const [publicTier, setPublicTier] = useState(
    trigger?.public_reply_ai_tier ?? 'standard',
  );
  const [dmEnabled, setDmEnabled] = useState(trigger?.dm_enabled ?? true);
  const [dmMode, setDmMode] = useState(trigger?.dm_mode ?? 'static');
  const [dmTemplate, setDmTemplate] = useState(trigger?.dm_template ?? '');
  const [dmTier, setDmTier] = useState(trigger?.dm_ai_tier ?? 'standard');
  const [createDeal, setCreateDeal] = useState(
    trigger?.create_deal_on_match ?? false,
  );
  const [dealStage, setDealStage] = useState(trigger?.deal_stage ?? 'lead');
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mx-4 max-w-2xl space-y-6 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-6 lg:mx-0"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const keywords = keywordsText
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean);
            await onSave({
              accountId,
              triggerId: trigger?.id,
              name,
              keywords,
              match_type: matchType,
              scope: trigger?.scope ?? 'all_posts',
              public_reply_enabled: publicEnabled,
              public_reply_mode: publicMode,
              public_reply_template: publicTemplate || null,
              public_reply_ai_tier: publicTier,
              dm_enabled: dmEnabled,
              dm_mode: dmMode,
              dm_template: dmTemplate || null,
              dm_ai_tier: dmTier,
              create_deal_on_match: createDeal,
              deal_stage: dealStage,
              is_active: trigger?.is_active ?? true,
            });
            toast.success('Trigger saved');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed');
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="trigger-name">Name</Label>
        <Input
          id="trigger-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trigger-keywords">Keywords (comma-separated)</Label>
        <Input
          id="trigger-keywords"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trigger-match">Match type</Label>
        <select
          id="trigger-match"
          className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-transparent px-3 py-2 text-sm"
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as typeof matchType)}
        >
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
          <option value="regex">Regex</option>
        </select>
      </div>

      <div className="space-y-3 rounded-md border border-[color:var(--workspace-shell-border)] p-4">
        <div className="flex items-center justify-between">
          <Label>Public reply</Label>
          <Switch checked={publicEnabled} onCheckedChange={setPublicEnabled} />
        </div>
        {publicEnabled ? (
          <>
            <select
              className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-transparent px-3 py-2 text-sm"
              value={publicMode}
              onChange={(e) =>
                setPublicMode(e.target.value as typeof publicMode)
              }
            >
              <option value="static">Static template</option>
              <option value="ai_generated">AI generated</option>
            </select>
            {publicMode === 'static' ? (
              <Textarea
                value={publicTemplate}
                onChange={(e) => setPublicTemplate(e.target.value)}
                placeholder="Thanks for commenting! ..."
              />
            ) : (
              <select
                className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-transparent px-3 py-2 text-sm"
                value={publicTier}
                onChange={(e) =>
                  setPublicTier(e.target.value as typeof publicTier)
                }
              >
                <option value="standard">Standard (Haiku, 5 credits)</option>
                <option value="enhanced">Enhanced (Sonnet, 10 credits)</option>
              </select>
            )}
          </>
        ) : null}
      </div>

      <div className="space-y-3 rounded-md border border-[color:var(--workspace-shell-border)] p-4">
        <div className="flex items-center justify-between">
          <Label>Private DM</Label>
          <Switch checked={dmEnabled} onCheckedChange={setDmEnabled} />
        </div>
        {dmEnabled ? (
          <>
            <select
              className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-transparent px-3 py-2 text-sm"
              value={dmMode}
              onChange={(e) => setDmMode(e.target.value as typeof dmMode)}
            >
              <option value="static">Static template</option>
              <option value="ai_generated">AI generated</option>
            </select>
            {dmMode === 'static' ? (
              <Textarea
                value={dmTemplate}
                onChange={(e) => setDmTemplate(e.target.value)}
                placeholder="Hey! Thanks for reaching out..."
              />
            ) : (
              <select
                className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-transparent px-3 py-2 text-sm"
                value={dmTier}
                onChange={(e) => setDmTier(e.target.value as typeof dmTier)}
              >
                <option value="standard">Standard (Haiku, 5 credits)</option>
                <option value="enhanced">Enhanced (Sonnet, 10 credits)</option>
              </select>
            )}
          </>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Create CRM lead on match</Label>
          <Switch checked={createDeal} onCheckedChange={setCreateDeal} />
        </div>
        {createDeal ? (
          <div className="space-y-2">
            <Label htmlFor="deal-stage">Deal stage</Label>
            <Input
              id="deal-stage"
              value={dealStage}
              onChange={(e) => setDealStage(e.target.value)}
            />
          </div>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        Save trigger
      </Button>
    </form>
  );
}
