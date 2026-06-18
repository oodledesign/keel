'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function RanklyProjectSettingsForm(props: {
  accountId: string;
  projectId: string;
  initial: {
    brief_brand_name: string | null;
    brief_voice_notes: string | null;
    brief_mention_rules: string | null;
    brief_research_depth: 'standard' | 'deep';
  };
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(props.initial.brief_brand_name ?? '');
  const [voiceNotes, setVoiceNotes] = useState(props.initial.brief_voice_notes ?? '');
  const [mentionRules, setMentionRules] = useState(
    props.initial.brief_mention_rules ?? '',
  );
  const [researchDepth, setResearchDepth] = useState<'standard' | 'deep'>(
    props.initial.brief_research_depth,
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/rankly/projects/${props.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          brief_brand_name: brandName.trim() || null,
          brief_voice_notes: voiceNotes.trim() || null,
          brief_mention_rules: mentionRules.trim() || null,
          brief_research_depth: researchDepth,
        }),
      });

      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }

      toast.success('Brief settings saved');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="brief-brand-name">Brand name</Label>
        <Input
          id="brief-brand-name"
          value={brandName}
          onChange={(event) => setBrandName(event.target.value)}
          placeholder="How the brand should be referred to in briefs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief-voice-notes">Voice & tone</Label>
        <Textarea
          id="brief-voice-notes"
          value={voiceNotes}
          onChange={(event) => setVoiceNotes(event.target.value)}
          rows={4}
          placeholder="e.g. Professional but approachable. Avoid jargon. UK English."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief-mention-rules">Mention rules</Label>
        <Textarea
          id="brief-mention-rules"
          value={mentionRules}
          onChange={(event) => setMentionRules(event.target.value)}
          rows={3}
          placeholder="e.g. Always mention the product name. Never cite competitors by name."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief-research-depth">Research depth</Label>
        <select
          id="brief-research-depth"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          value={researchDepth}
          onChange={(event) =>
            setResearchDepth(event.target.value as 'standard' | 'deep')
          }
        >
          <option value="standard">Standard — balanced depth</option>
          <option value="deep">Deep — more thorough competitor analysis</option>
        </select>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  );
}
