'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check } from 'lucide-react';
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
    line: 'border-[color:var(--ozer-plum-950)] focus-within:border-[color:var(--ozer-accent)] dark:border-[color:var(--ozer-text-on-dark)]',
    input:
      'text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]',
    button:
      'focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)]',
    successTitle: 'text-[var(--workspace-shell-text)]',
    successBody: 'text-[var(--workspace-shell-text-muted)]',
    error: 'text-[var(--ozer-coral-600)] dark:text-[var(--ozer-coral-400)]',
  },
  dark: {
    line: 'border-[color:var(--ozer-on-dark-alpha-65)] focus-within:border-[color:var(--ozer-accent)]',
    input:
      'text-[var(--ozer-text-on-dark)] placeholder:text-[var(--ozer-text-on-dark-muted)]',
    button: 'focus-visible:ring-offset-[var(--ozer-plum-950)]',
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
          'flex max-w-xl items-start gap-3 border-b pb-3 text-left',
          styles.line,
          className,
        )}
        role="status"
        data-test="waitlist-success"
      >
        <Check
          className="mt-1 size-4 shrink-0 text-[var(--ozer-sage-500)]"
          strokeWidth={2.5}
          aria-hidden
        />
        <div>
          <p className={cn('text-base font-medium', styles.successTitle)}>
            You&apos;re on the list.
          </p>
          <p className={cn('text-sm', styles.successBody)}>
            We&apos;ll email you personally. There is no automated sequence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className={cn('max-w-xl', className)}
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
            <FormItem className="space-y-2">
              <label htmlFor={id} className="sr-only">
                {label}
              </label>
              <div
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2 transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_1px_0_0_var(--ozer-accent)]',
                  styles.line,
                )}
              >
                <FormControl>
                  <input
                    {...field}
                    id={id}
                    type="email"
                    autoComplete="email"
                    placeholder={placeholder}
                    data-test="waitlist-email-input"
                    className={cn(
                      'h-11 min-w-0 flex-1 basis-56 bg-transparent text-base outline-none md:text-[1.0625rem]',
                      styles.input,
                    )}
                  />
                </FormControl>
                <button
                  type="submit"
                  disabled={pending}
                  data-test="waitlist-submit-button"
                  className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-[var(--ozer-radius-control)] bg-[var(--ozer-accent)] px-5 text-[0.9375rem] font-medium whitespace-nowrap text-[var(--ozer-plum-950)]',
                    'hover:bg-[var(--ozer-coral-600)] hover:text-[var(--ozer-cream-50)]',
                    'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2 focus-visible:outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-70',
                    styles.button,
                    marketingBtnPress,
                  )}
                >
                  {pending ? 'Joining…' : buttonLabel}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <FormMessage className={cn('text-sm', styles.error)} />
            </FormItem>
          )}
        />
        {submitError ? (
          <p className={cn('mt-2 text-sm', styles.error)} role="alert">
            {submitError}
          </p>
        ) : null}
      </form>
    </Form>
  );
}
