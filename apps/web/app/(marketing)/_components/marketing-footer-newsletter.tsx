'use client';

import { type FormEvent, useState } from 'react';

import { ArrowRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

/** Pill newsletter field — opens a mailto compose (no list backend yet). */
export function MarketingFooterNewsletter({
  className,
}: {
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    const subject = encodeURIComponent('Ozer newsletter');
    const body = encodeURIComponent(
      `Please add ${trimmed} to the Ozer product updates list.`,
    );
    window.location.href = `mailto:hello@ozer.so?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="font-heading text-sm font-semibold text-[var(--workspace-shell-text)]">
        Newsletter
      </p>
      <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
        Get tips, product updates, and insights on running a calmer studio.
      </p>
      {sent ? (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-[var(--ozer-coral-600)]"
        >
          Your email app should open — send to finish signing up.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 shadow-sm"
        >
          <label className="sr-only" htmlFor="footer-newsletter-email">
            Email address
          </label>
          <input
            id="footer-newsletter-email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-sm text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          <button
            type="submit"
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ozer-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ozer-plum-950)]',
              'transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[var(--ozer-accent-hover)] active:scale-[0.97]',
            )}
          >
            Subscribe
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
