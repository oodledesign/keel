'use client';

import { useEffect, useState } from 'react';

import { Check } from 'lucide-react';

import type { StepDef } from '../_lib/onboarding-steps.config';

const STORAGE_KEY = 'onboarding_saved_step';

function getStoredStep(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v ? Math.max(1, parseInt(v, 10)) : 0;
  } catch {
    return 0;
  }
}

function setStoredStep(step: number) {
  if (typeof window === 'undefined' || step < 1) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(step));
  } catch {
    // ignore
  }
}

interface StepSidebarProps {
  steps: StepDef[];
  currentIndex: number;
  currentStep: number;
  accountName?: string | null;
  /** Saved onboarding step from DB: steps before this show as completed (green tick) when going back */
  savedOnboardingStep?: number | null;
}

export function StepSidebar({
  steps,
  currentIndex,
  currentStep,
  accountName,
  savedOnboardingStep,
}: StepSidebarProps) {
  // Start at 0 so server and client initial render match (avoids hydration error from sessionStorage)
  const [storedStep, setStoredStepState] = useState(0);

  // After mount, read sessionStorage so client-only value doesn't affect first paint
  useEffect(() => {
    setStoredStepState(getStoredStep());
  }, []);

  // Persist when server sends a valid saved step (so back-navigation can show ticks even if payload is cached)
  useEffect(() => {
    const step = savedOnboardingStep ?? 0;
    if (step >= 1) {
      setStoredStep(step);
      setStoredStepState((prev) => (step > prev ? step : prev));
    }
  }, [savedOnboardingStep]);

  // When user moves forward, update stored step so going back later still shows ticks
  useEffect(() => {
    if (currentStep >= 1) {
      const next = Math.max(getStoredStep(), currentStep);
      setStoredStep(next);
      setStoredStepState((prev) => (next > prev ? next : prev));
    }
  }, [currentStep]);

  // Step shows green tick if we're on a later step OR saved progress is past it (so ticks persist when going back).
  // Use only server-safe values so server and client first render match (storedStep is 0 until after mount).
  const completedThreshold = Math.max(
    currentStep,
    savedOnboardingStep ?? 0,
    storedStep,
  );
  return (
    <nav className="space-y-1">
      {accountName && (
        <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Business
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-white">
            {accountName}
          </p>
        </div>
      )}
      <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Steps
      </p>
      {steps.map((s, idx) => {
        const isCompleted = s.step < completedThreshold;
        const isCurrent = s.step === currentStep;
        return (
          <div
            key={s.key}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              isCurrent
                ? 'bg-zinc-800 text-white'
                : isCompleted
                  ? 'text-zinc-400'
                  : 'text-zinc-500'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isCompleted
                  ? 'bg-emerald-600/80 text-white'
                  : isCurrent
                    ? 'bg-zinc-700 text-white'
                    : 'border border-zinc-600 text-zinc-500'
              }`}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </span>
            <span>{s.title}</span>
          </div>
        );
      })}
    </nav>
  );
}
