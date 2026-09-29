import { ArrowRight, Check, X } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_PAIN_FIX } from '~/lib/marketing/commercial-home-content';
import {
  marketingFeatureCard,
  marketingMutedText,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

export function PainFixSection() {
  return (
    <section
      className="relative mx-auto w-full max-w-7xl px-6 pt-20 pb-8 md:pt-24"
      aria-labelledby="pain-fix-heading"
    >
      <div className="mb-10 max-w-2xl md:mx-auto md:text-center">
        <h2
          id="pain-fix-heading"
          className={cn(
            marketingSectionHeading,
            'text-[var(--workspace-shell-text)]',
          )}
        >
          Built for how a commercial desk actually works.
        </h2>
        <p className={cn('mt-3 text-base leading-relaxed', marketingMutedText)}>
          Not a residential CRM with the word “commercial” bolted on. Ozer
          starts from disposals, requirements and the fee pipeline.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
        {COMMERCIAL_HOME_PAIN_FIX.map((item) => (
          <li
            key={item.pain}
            className={cn(
              'flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] p-6',
              marketingFeatureCard,
            )}
          >
            <p className="flex items-start gap-3 text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-coral-50)] text-[var(--ozer-coral-600)]"
                aria-hidden
              >
                <X className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">Before: </span>
                {item.pain}
              </span>
            </p>
            <ArrowRight
              className="ml-1 size-4 rotate-90 text-[var(--workspace-shell-text-muted)]"
              aria-hidden
            />
            <p className="flex items-start gap-3 text-base leading-relaxed font-medium text-[var(--workspace-shell-text)]">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]"
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">With Ozer: </span>
                {item.fix}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
