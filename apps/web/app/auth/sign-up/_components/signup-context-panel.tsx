import { Check } from 'lucide-react';

import type { SignupContext } from '~/lib/auth/signup-context';

export function SignupContextPanel({ context }: { context: SignupContext }) {
  if (!context.badge && context.highlights.length === 0) {
    return null;
  }

  return (
    <div
      data-test="signup-context-panel"
      className="bg-muted/50 border-border/60 w-full rounded-xl border px-4 py-3 text-left"
    >
      {context.badge ? (
        <p className="text-muted-foreground mb-2 text-[0.7rem] font-medium tracking-wide uppercase">
          {context.badge}
        </p>
      ) : null}
      <ul className="space-y-2">
        {context.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-snug">
            <Check
              className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden
            />
            <span className="text-foreground/90">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
