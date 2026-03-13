'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Label } from '@kit/ui/label';

import { ACCESSIBILITY_UPDATED_EVENT } from '~/components/text-size-sync';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import { upsertUserSettings } from '../../../../../onboarding/_lib/server/onboarding.actions';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader } from '@kit/ui/card';

const TEXT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
] as const;

interface InitialSettings {
  accessibility_text_size: string;
  accessibility_high_contrast: boolean;
  accessibility_simplified_mode: boolean;
  accessibility_enhanced_focus: boolean;
  accessibility_dyslexia_font: boolean;
}

export function AccessibilitySettingsForm({
  initial,
}: {
  initial: InitialSettings;
}) {
  const router = useRouter();
  const [textSize, setTextSize] = useState<'small' | 'standard' | 'large'>(
    (initial.accessibility_text_size as 'small' | 'standard' | 'large') ?? 'standard',
  );
  const [highContrast, setHighContrast] = useState(initial.accessibility_high_contrast ?? false);
  const [simplifiedMode, setSimplifiedMode] = useState(initial.accessibility_simplified_mode ?? true);
  const [enhancedFocus, setEnhancedFocus] = useState(initial.accessibility_enhanced_focus ?? true);
  const [dyslexiaFont, setDyslexiaFont] = useState(initial.accessibility_dyslexia_font ?? false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await upsertUserSettings({
        accessibility_text_size: textSize,
        accessibility_high_contrast: highContrast,
        accessibility_simplified_mode: simplifiedMode,
        accessibility_enhanced_focus: enhancedFocus,
        accessibility_dyslexia_font: dyslexiaFont,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Preferences saved.');
      router.refresh();
      // Defer so we run after React applies the refreshed layout (which resets html class)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(ACCESSIBILITY_UPDATED_EVENT));
      }, 150);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-white/6 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <Label className="text-base font-medium">Text size</Label>
          <p className="text-sm font-normal text-zinc-400">
            Choose the default text size for the app.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEXT_SIZES.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant="outline"
                size="sm"
                className={
                  textSize === opt.value
                    ? 'border-emerald-400/60 bg-emerald-500 text-[#05120b] hover:bg-emerald-400'
                    : 'border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-300 hover:bg-[var(--workspace-shell-panel-hover)]'
                }
                onClick={() => setTextSize(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-[var(--workspace-shell-panel)]">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base font-medium">High contrast</Label>
                <p className="text-muted-foreground text-sm">Increase contrast for readability.</p>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base font-medium">Simplified mode</Label>
                <p className="text-muted-foreground text-sm">Reduce visual clutter.</p>
              </div>
              <Switch checked={simplifiedMode} onCheckedChange={setSimplifiedMode} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base font-medium">Enhanced focus</Label>
                <p className="text-muted-foreground text-sm">Highlight focused elements.</p>
              </div>
              <Switch checked={enhancedFocus} onCheckedChange={setEnhancedFocus} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base font-medium">Dyslexia-friendly font</Label>
                <p className="text-muted-foreground text-sm">Use a more readable font.</p>
              </div>
              <Switch checked={dyslexiaFont} onCheckedChange={setDyslexiaFont} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Save preferences'}
      </Button>
    </form>
  );
}
