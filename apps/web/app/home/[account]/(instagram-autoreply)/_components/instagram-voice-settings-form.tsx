'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type { IgVoiceSettings } from '~/lib/instagram-autoreply/types';

const TONES: IgVoiceSettings['tone'][] = [
  'friendly',
  'professional',
  'casual',
  'playful',
];

const EMOJI_OPTIONS: IgVoiceSettings['emoji_usage'][] = [
  'none',
  'light',
  'heavy',
];

type InstagramVoiceSettingsFormProps = {
  accountId: string;
  initial: IgVoiceSettings;
  onSave: (input: {
    accountId: string;
    voiceSettings: IgVoiceSettings;
  }) => Promise<{ ok: boolean }>;
  onPreview: (input: {
    accountId: string;
    sampleComment: string;
    voiceSettings?: IgVoiceSettings;
  }) => Promise<
    | { ok: true; text: string; creditsSpent: number }
    | { ok: false; code?: string; error?: string }
  >;
};

export function InstagramVoiceSettingsForm({
  accountId,
  initial,
  onSave,
  onPreview,
}: InstagramVoiceSettingsFormProps) {
  const [settings, setSettings] = useState<IgVoiceSettings>(initial);
  const [sampleComment, setSampleComment] = useState(
    'Love this! How do I find out more?',
  );
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-4 space-y-6 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-6 lg:mx-0">
      <div>
        <Label className="mb-2 block">Tone</Label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <Button
              key={tone}
              type="button"
              size="sm"
              variant={settings.tone === tone ? 'default' : 'outline'}
              onClick={() => setSettings((s) => ({ ...s, tone }))}
            >
              {tone}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Emoji usage</Label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((usage) => (
            <Button
              key={usage}
              type="button"
              size="sm"
              variant={settings.emoji_usage === usage ? 'default' : 'outline'}
              onClick={() => setSettings((s) => ({ ...s, emoji_usage: usage }))}
            >
              {usage}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ig-language">Language</Label>
        <Input
          id="ig-language"
          value={settings.language}
          onChange={(e) =>
            setSettings((s) => ({ ...s, language: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ig-custom">Custom instructions</Label>
        <Textarea
          id="ig-custom"
          rows={4}
          value={settings.custom_instructions}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              custom_instructions: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ig-sample">Sample comment for preview</Label>
        <Input
          id="ig-sample"
          value={sampleComment}
          onChange={(e) => setSampleComment(e.target.value)}
        />
      </div>

      {previewText ? (
        <div className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-3 text-sm">
          {previewText}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await onSave({ accountId, voiceSettings: settings });
                toast.success('Voice settings saved');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Save failed');
              }
            })
          }
        >
          Save voice settings
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await onPreview({
                  accountId,
                  sampleComment,
                  voiceSettings: settings,
                });
                if (!result.ok) {
                  toast.error(result.error ?? 'Preview failed');
                  return;
                }
                setPreviewText(result.text);
                toast.success(
                  `Preview generated (${result.creditsSpent} credits)`,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Preview failed');
              }
            })
          }
        >
          Preview reply
        </Button>
      </div>
    </div>
  );
}
