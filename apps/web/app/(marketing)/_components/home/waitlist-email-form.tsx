'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import { cn } from '@kit/ui/utils';

import {
  type LaunchInterestSource,
  WaitlistEmailSchema,
  type WaitlistEmailValues,
} from '~/lib/marketing/launch-interest';
import { marketingBtnPress } from '~/lib/marketing/marketing-ui';

type WaitlistEmailFormProps = {
  id: string;
  source: LaunchInterestSource;
  tone?: 'light' | 'dark';
  label?: string;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
};

const TONE_CLASSES = {
  light: {
    input:
      'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)]',
    button:
      'focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)]',
    success:
      'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
    successTitle: 'text-[var(--workspace-shell-text)]',
    successBody: 'text-[var(--workspace-shell-text-muted)]',
    error: 'text-[var(--ozer-coral-600)]',
  },
  dark: {
    input:
      'border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-on-dark-alpha-08)] text-[var(--ozer-text-on-dark)] placeholder:text-[var(--ozer-text-on-dark-muted)] focus-visible:ring-offset-[var(--ozer-plum-950)]',
    button: 'focus-visible:ring-offset-[var(--ozer-plum-950)]',
    success:
      'border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-on-dark-alpha-08)]',
    successTitle: 'text-[var(--ozer-text-on-dark)]',
    successBody: 'text-[var(--ozer-text-on-dark-muted)]',
    error: 'text-[var(--ozer-coral-400)]',
  },
} as const;

type SubmitResult = { ok: true } | { ok: false; message: string };

async function joinWaitlist(
  values: WaitlistEmailValues,
  source: LaunchInterestSource,
): Promise<SubmitResult> {
  try {
    const response = await fetch('/api/launch-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: values.email,
        interests: ['commercial'],
        source,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 429 && payload?.error?.includes('already')) {
      return { ok: true };
    }

    return {
      ok: false,
      message: payload?.error ?? 'Something went wrong. Please try again.',
    };
  } catch {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}

export function WaitlistEmailForm({
  id,
  source,
  tone = 'light',
  label = 'Work email',
  placeholder = 'you@youragency.co.uk',
  buttonLabel = 'Join the waiting list',
  className,
}: WaitlistEmailFormProps) {
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const styles = TONE_CLASSES[tone];

  const form = useForm<WaitlistEmailValues>({
    resolver: zodResolver(WaitlistEmailSchema),
    defaultValues: { email: '' },
  });

  if (done) {
    return (
      <div
        className={cn(
          'flex max-w-md items-center gap-3 rounded-full border px-5 py-3 text-left',
          styles.success,
          className,
        )}
        role="status"
        data-test="waitlist-success"
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-sage-500)] text-[var(--ozer-white)]"
          aria-hidden
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <div>
          <p className={cn('text-sm font-semibold', styles.successTitle)}>
            You&apos;re on the list.
          </p>
          <p className={cn('text-xs', styles.successBody)}>
            We&apos;ll email you personally — no automated sequence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className={cn('flex max-w-md flex-wrap items-start gap-2.5', className)}
        noValidate
        data-test="waitlist-form"
        onSubmit={form.handleSubmit((values) => {
          setSubmitError(null);
          startTransition(async () => {
            const result = await joinWaitlist(values, source);

            if (result.ok) {
              setDone(true);
            } else {
              setSubmitError(result.message);
            }
          });
        })}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1 basis-60 space-y-0">
              <label htmlFor={id} className="sr-only">
                {label}
              </label>
              <FormControl>
                <input
                  {...field}
                  id={id}
                  type="email"
                  autoComplete="email"
                  placeholder={placeholder}
                  data-test="waitlist-email-input"
                  className={cn(
                    'w-full rounded-full border px-4 py-3 text-sm outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2',
                    styles.input,
                  )}
                />
              </FormControl>
              <FormMessage
                className={cn('mt-1.5 px-4 text-sm', styles.error)}
              />
            </FormItem>
          )}
        />
        <button
          type="submit"
          disabled={pending}
          data-test="waitlist-submit-button"
          className={cn(
            'rounded-full bg-[var(--ozer-accent)] px-6 py-3 text-sm font-semibold whitespace-nowrap text-[var(--ozer-plum-950)]',
            'hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]',
            'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-70',
            styles.button,
            marketingBtnPress,
          )}
        >
          {pending ? 'Joining…' : buttonLabel}
        </button>
        {submitError ? (
          <p className={cn('w-full px-4 text-sm', styles.error)} role="alert">
            {submitError}
          </p>
        ) : null}
      </form>
    </Form>
  );
}
