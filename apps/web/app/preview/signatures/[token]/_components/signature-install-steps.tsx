'use client';

import { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  OUTLOOK_INSTALL_STEPS,
  type SignatureInstallStep,
} from '~/lib/signatures/install-instructions';

export function SignatureInstallSteps({
  steps = OUTLOOK_INSTALL_STEPS,
}: {
  steps?: SignatureInstallStep[];
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? steps[0]!;
  const total = steps.length;

  return (
    <section
      className="rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white p-5 shadow-[0_1px_2px_rgba(42,23,32,0.05),0_4px_14px_rgba(42,23,32,0.05)] sm:p-6"
      aria-roledescription="carousel"
      aria-label="How to install your signature in Outlook"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-muted)] uppercase">
          Install in Outlook
        </p>
        <p className="text-xs tabular-nums text-[var(--ozer-text-muted)]">
          Step {index + 1} of {total}
        </p>
      </div>

      <div className="mt-4 min-h-[140px]">
        <p className="font-[family-name:var(--ozer-font-display)] text-xl font-bold tracking-tight text-[var(--ozer-plum-900)]">
          {step.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ozer-text-muted)]">
          {step.body}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-plum-900)]"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-1.5" aria-hidden>
          {steps.map((_, stepIndex) => (
            <button
              key={stepIndex}
              type="button"
              className={cn(
                'h-1.5 rounded-full transition-all',
                stepIndex === index
                  ? 'w-5 bg-[var(--ozer-accent)]'
                  : 'w-1.5 bg-[color-mix(in_srgb,var(--ozer-plum-900)_18%,transparent)]',
              )}
              onClick={() => setIndex(stepIndex)}
              aria-label={`Go to step ${stepIndex + 1}`}
            />
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          disabled={index >= total - 1}
          onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
