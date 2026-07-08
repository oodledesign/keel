import { Check } from 'lucide-react';

import type { SignupContext } from '~/lib/auth/signup-context';
import { cn } from '@kit/ui/utils';

export function SignupContextPanel({
  context,
  className,
}: {
  context: SignupContext;
  className?: string;
}) {
  if (!context.badge && context.highlights.length === 0) {
    return null;
  }

  return (
    <div
      data-test="signup-context-panel"
      className={cn('w-full text-left', className)}
    >
      {context.badge ? (
        <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--ozer-coral-400)] uppercase">
          {context.badge}
        </p>
      ) : null}
      <ul className="space-y-3">
        {context.highlights.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-snug text-[var(--ozer-text-on-dark-muted)]"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]">
              <Check className="h-3 w-3" aria-hidden />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
