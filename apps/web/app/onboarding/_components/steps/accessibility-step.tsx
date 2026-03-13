'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  completeOnboarding,
  updateOnboardingStep,
  upsertUserSettings,
} from '../../_lib/server/onboarding.actions';
import type { StepDef } from '../../_lib/onboarding-steps.config';
import { PrimaryButton } from '../primary-button';
import { SegmentedControl } from '../segmented-control';
import { ToggleRow } from '../toggle-row';

interface AccessibilityStepProps {
  accountId: string;
  accountSlug: string;
  nextStep: number;
  isLastStep: boolean;
  initial?: {
    accessibility_text_size: string;
    accessibility_high_contrast: boolean;
    accessibility_simplified_mode: boolean;
    accessibility_enhanced_focus: boolean;
    accessibility_dyslexia_font: boolean;
  };
}

const TEXT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
] as const;

export function AccessibilityStep({
  accountId,
  accountSlug,
  nextStep,
  isLastStep,
  initial,
}: AccessibilityStepProps) {
  const router = useRouter();
  const [textSize, setTextSize] = useState<
    'small' | 'standard' | 'large'
  >(
    (initial?.accessibility_text_size as
      | 'small'
      | 'standard'
      | 'large') ?? 'standard',
  );
  const [highContrast, setHighContrast] = useState(
    initial?.accessibility_high_contrast ?? false,
  );
  const [simplifiedMode, setSimplifiedMode] = useState(
    initial?.accessibility_simplified_mode ?? true,
  );
  const [enhancedFocus, setEnhancedFocus] = useState(
    initial?.accessibility_enhanced_focus ?? true,
  );
  const [dyslexiaFont, setDyslexiaFont] = useState(
    initial?.accessibility_dyslexia_font ?? false,
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await upsertUserSettings({
        accessibility_text_size: textSize,
        accessibility_high_contrast: highContrast,
        accessibility_simplified_mode: simplifiedMode,
        accessibility_enhanced_focus: enhancedFocus,
        accessibility_dyslexia_font: dyslexiaFont,
      });
      if (isLastStep) {
        const result = await completeOnboarding(accountId);
        if (result?.error) {
          setLoading(false);
          return;
        }
        router.push(`/home/${accountSlug}`);
      } else {
        await updateOnboardingStep(accountId, nextStep);
        router.push(`/onboarding?account_id=${accountId}&step=${nextStep}`);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Set Up Your Preferences
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Customise the app to work best for you. You can change these anytime in settings.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-zinc-300">
          Text size
        </span>
        <SegmentedControl
          options={TEXT_SIZES}
          value={textSize}
          onChange={(v) =>
            setTextSize(v as 'small' | 'standard' | 'large')
          }
        />
      </div>

      <div className="space-y-2">
        <ToggleRow
          label="High contrast"
          description="Increase contrast for readability"
          checked={highContrast}
          onCheckedChange={setHighContrast}
        />
        <ToggleRow
          label="Simplified mode"
          description="Reduce visual clutter"
          checked={simplifiedMode}
          onCheckedChange={setSimplifiedMode}
        />
        <ToggleRow
          label="Enhanced focus"
          description="Highlight focused elements"
          checked={enhancedFocus}
          onCheckedChange={setEnhancedFocus}
        />
        <ToggleRow
          label="Dyslexia-friendly font"
          description="Use a more readable font"
          checked={dyslexiaFont}
          onCheckedChange={setDyslexiaFont}
        />
      </div>

      <PrimaryButton type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Continue'}
      </PrimaryButton>
    </form>
  );
}
