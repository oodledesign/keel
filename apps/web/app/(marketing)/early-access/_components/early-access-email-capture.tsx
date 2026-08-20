'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import { cn } from '@kit/ui/utils';

import { EarlyAccessSignupSchema } from '~/(marketing)/early-access/_lib/early-access-signup.schema';
import { sendEarlyAccessSignup } from '~/(marketing)/early-access/_lib/server/server-actions';
import { marketingBtnPress } from '~/lib/marketing/marketing-ui';

type EarlyAccessEmailCaptureProps = {
  id: string;
  buttonLabel?: string;
  className?: string;
};

type FormValues = z.infer<typeof EarlyAccessSignupSchema>;

export function EarlyAccessEmailCapture({
  id,
  buttonLabel = 'Get early access',
  className,
}: EarlyAccessEmailCaptureProps) {
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(EarlyAccessSignupSchema),
    defaultValues: { email: '' },
  });

  if (done) {
    return (
      <div
        className={cn(
          'mx-auto flex max-w-md items-center gap-3 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-5 py-3 text-left',
          className,
        )}
        role="status"
        data-test="early-access-signup-success"
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-sage-500)] text-[var(--ozer-white)]"
          aria-hidden
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            You&apos;re on the list.
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            We&apos;ll email you directly — no automated sequence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className={cn(
          'mx-auto flex max-w-md flex-wrap items-center justify-center gap-2.5',
          className,
        )}
        noValidate
        onSubmit={form.handleSubmit((data) => {
          setSubmitError(false);
          startTransition(async () => {
            try {
              await sendEarlyAccessSignup(data);
              setDone(true);
            } catch {
              setSubmitError(true);
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
                Email address
              </label>
              <FormControl>
                <input
                  {...field}
                  id={id}
                  type="email"
                  autoComplete="email"
                  placeholder="you@studio.com"
                  data-test="early-access-email-input"
                  className={cn(
                    'w-full rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 text-sm text-[var(--workspace-shell-text)] outline-none',
                    'placeholder:text-[var(--workspace-shell-text-muted)]',
                    'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)]',
                  )}
                />
              </FormControl>
              <FormMessage className="mt-1.5 text-center text-sm text-[var(--ozer-coral-600)]" />
            </FormItem>
          )}
        />
        <button
          type="submit"
          disabled={pending}
          data-test="early-access-submit-button"
          className={cn(
            'rounded-full bg-[var(--ozer-accent)] px-6 py-3 text-sm font-semibold whitespace-nowrap text-[var(--ozer-plum-950)]',
            'hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]',
            'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ozer-cream-50)] focus-visible:outline-none dark:focus-visible:ring-offset-[var(--ozer-plum-900)]',
            'disabled:cursor-not-allowed disabled:opacity-70',
            marketingBtnPress,
          )}
        >
          {pending ? 'Sending…' : buttonLabel}
        </button>
        {submitError ? (
          <p
            className="w-full text-center text-sm text-[var(--ozer-coral-600)]"
            role="alert"
          >
            Something went wrong. Please try again.
          </p>
        ) : null}
      </form>
    </Form>
  );
}
