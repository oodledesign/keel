'use client';

import { useState } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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
import { Textarea } from '@kit/ui/textarea';

import { estimateTtsCost } from '~/lib/billing/media-unit-pricing';
import {
  IG_TTS_MAX_CHARS,
  IG_TTS_PRESET_VOICES,
} from '~/lib/instagram-autoreply/audio/tts-voices';
import {
  type IgAssetListItem,
  generateIgTtsAsset,
} from '~/lib/instagram-autoreply/audio/upload-asset.client';
import {
  workspaceBorder,
  workspaceBtnPrimaryMd,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

const CUSTOM = '__custom';

export function IgTtsGenerator(props: {
  accountId: string;
  onSaved: (asset: IgAssetListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [voice, setVoice] = useState<string>(IG_TTS_PRESET_VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCustom = voice === CUSTOM;
  const units = estimateTtsCost(text.trim().length);
  const canGenerate =
    text.trim().length > 0 &&
    (!isCustom || (customVoiceId.trim().length > 0 && consent)) &&
    !busy;

  async function generate() {
    setBusy(true);
    try {
      const asset = await generateIgTtsAsset({
        accountId: props.accountId,
        label: label.trim() || text.trim().slice(0, 60),
        text: text.trim(),
        voice: isCustom ? customVoiceId.trim() : voice,
        customVoice: isCustom,
        voiceCloneConsent: isCustom && consent,
      });
      props.onSaved(asset);
      toast.success('Voice note generated');
      setText('');
      setLabel('');
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Voice generation failed',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="mr-1 h-4 w-4" aria-hidden />
        Generate from text
      </Button>
    );
  }

  return (
    <div className={`space-y-3 rounded-xl border p-3 ${workspaceBorder}`}>
      <div className="space-y-1">
        <Label htmlFor="ig-tts-text">What should it say?</Label>
        <Textarea
          id="ig-tts-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={IG_TTS_MAX_CHARS}
          rows={3}
          placeholder="Hey! Thanks for commenting. Here's the guide I mentioned…"
        />
        <p className={`text-xs ${workspaceTextMuted}`}>
          {text.length}/{IG_TTS_MAX_CHARS} characters · voice notes must be 60
          seconds or shorter
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Voice</Label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger aria-label="Voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              {IG_TTS_PRESET_VOICES.map((v) => (
                <SelectItem
                  key={v.id}
                  value={v.id}
                  className={workspaceSelectItemClass}
                >
                  {v.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM} className={workspaceSelectItemClass}>
                My own voice ID…
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ig-tts-label">Name (optional)</Label>
          <Input
            id="ig-tts-label"
            value={label}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      {isCustom ? (
        <div className="space-y-2">
          <Input
            value={customVoiceId}
            onChange={(e) => setCustomVoiceId(e.target.value)}
            placeholder="ElevenLabs voice ID"
            aria-label="ElevenLabs voice ID"
          />
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              className="mt-0.5"
            />
            <span>
              I confirm the person whose voice this is has given their consent
              for it to be used in automated messages. We record who confirmed
              this and when.
            </span>
          </label>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${workspaceTextMuted}`}>
          Costs {units} media {units === 1 ? 'credit' : 'credits'}, charged once
          it&apos;s ready
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={!canGenerate}
            onClick={() => void generate()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
