'use client';

import { useFormStatus } from 'react-dom';

export function MailingListPreferenceSubmit({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'quiet';
}) {
  const { pending } = useFormStatus();

  const className =
    variant === 'primary'
      ? 'mt-8 inline-flex rounded-full bg-[var(--ozer-accent)] px-5 py-3 text-sm font-bold text-[var(--ozer-plum-950)] transition-opacity disabled:opacity-60'
      : 'mt-8 inline-flex rounded-full border border-[var(--ozer-border-on-light)] px-5 py-3 text-sm font-semibold text-[var(--workspace-shell-text)] transition-opacity disabled:opacity-60';

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      data-test={
        variant === 'primary'
          ? 'mailing-list-resubscribe'
          : 'mailing-list-unsubscribe'
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
