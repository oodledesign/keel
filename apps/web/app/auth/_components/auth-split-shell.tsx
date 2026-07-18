import type { ReactNode } from 'react';

import { Sparkles } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';

type Props = {
  /** Short line above the left headline, e.g. "You can easily" */
  brandEyebrow?: string;
  /** Main left-panel headline */
  brandHeadline: string;
  /** Optional bullets / highlights under the left headline */
  brandFooter?: ReactNode;
  /** Coral asterisk + form title */
  formTitle: string;
  formSubtitle?: string;
  children: ReactNode;
  className?: string;
};

/**
 * BrightNest-style auth card: light canvas, rounded split panel,
 * coral orb branding on the left and the form on the right.
 */
export function AuthSplitShell({
  brandEyebrow = 'You can easily',
  brandHeadline,
  brandFooter,
  formTitle,
  formSubtitle,
  children,
  className,
}: Props) {
  return (
    <div className={cn('w-full max-w-5xl', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-white)]',
          'shadow-[0_24px_64px_var(--ozer-plum-alpha-12)]',
          'grid md:grid-cols-2',
        )}
      >
        <aside className="relative flex min-h-[18rem] flex-col justify-between gap-10 overflow-hidden bg-[var(--ozer-cream-50)] px-8 py-10 md:min-h-[32rem] md:px-10 md:py-12">
          {/* Soft coral orb — matches BrightNest reference */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: [
                'radial-gradient(ellipse 90% 80% at 18% 28%, color-mix(in srgb, var(--ozer-coral-400) 55%, transparent), transparent 58%)',
                'radial-gradient(ellipse 70% 70% at 72% 78%, color-mix(in srgb, var(--ozer-coral-500) 28%, transparent), transparent 62%)',
                'radial-gradient(ellipse 50% 40% at 55% 12%, color-mix(in srgb, #ffb48c 35%, transparent), transparent 55%)',
              ].join(', '),
            }}
          />

          <div className="relative">
            <AppLogo className="h-7 w-auto" href="/" />
          </div>

          <div className="relative space-y-3">
            {brandEyebrow ? (
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                {brandEyebrow}
              </p>
            ) : null}
            <h1 className="font-heading max-w-sm text-2xl leading-tight font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-[1.85rem]">
              {brandHeadline}
            </h1>
            {brandFooter}
          </div>
        </aside>

        <div className="flex flex-col justify-center gap-6 bg-[var(--ozer-white)] px-6 py-8 md:px-10 md:py-12">
          <div className="space-y-2">
            <Sparkles
              className="size-5 text-[var(--ozer-accent)]"
              aria-hidden
            />
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-[1.75rem]">
              {formTitle}
            </h2>
            {formSubtitle ? (
              <p className="max-w-md text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
                {formSubtitle}
              </p>
            ) : null}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
