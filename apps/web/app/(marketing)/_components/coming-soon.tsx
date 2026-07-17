'use client';

import { type FormEvent, useState } from 'react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  marketingBtnGradient,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

const ITEMS = [
  {
    id: 'property',
    title: 'Property workspace',
    description:
      'Tenants, maintenance, and portfolio money for small landlords.',
  },
  {
    id: 'community',
    title: 'Community workspace',
    description:
      'Rotas, schedules, and tasks for clubs, teams, and homegroups.',
  },
  {
    id: 'rankly',
    title: 'Rankly',
    description:
      'See how your business shows up in Google and AI search, and fix it.',
  },
  {
    id: 'feeds',
    title: 'Feeds',
    description:
      'Embed social posts and reviews on your website, automatically.',
  },
] as const;

type Interest = (typeof ITEMS)[number]['id'];

const ALL_INTERESTS = ITEMS.map((item) => item.id);

export function ComingSoon() {
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState<Interest[]>([...ALL_INTERESTS]);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');

  const toggleInterest = (interest: Interest) => {
    setInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }

      return [...current, interest];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    const response = await fetch('/api/launch-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        interests: interests.length ? interests : ALL_INTERESTS,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      setStatus('error');
      setMessage(payload.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setStatus('success');
    setMessage(
      payload.message ?? "You're on the list — we'll email you at launch.",
    );
    setEmail('');
  };

  return (
    <section
      id="coming-soon"
      className="relative mx-auto w-full max-w-7xl px-6 py-16"
      aria-labelledby="coming-soon-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="coming-soon-heading"
          className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
        >
          Growing with you
        </h2>
        <p className={cn('mt-3 text-base leading-relaxed', marketingMutedText)}>
          Ozer will do more than run the studio. These workspaces and apps are
          in development — leave your email and be first in when they launch.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map((item) => (
          <article key={item.id} className={cn(marketingFeatureCard, 'p-5')}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
                {item.title}
              </h3>
              <span className="shrink-0 rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--ozer-coral-600)] uppercase">
                Coming soon
              </span>
            </div>
            <p
              className={cn('mt-2 text-sm leading-relaxed', marketingMutedText)}
            >
              {item.description}
            </p>
          </article>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className={cn(
          'mx-auto mt-8 max-w-3xl rounded-2xl border border-[color:var(--workspace-shell-border)] p-5 md:p-6',
          marketingFeatureCard,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="coming-soon-email">
            Email address
          </label>
          <input
            id="coming-soon-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-h-11 flex-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 text-sm text-[var(--workspace-shell-text)] transition outline-none focus:border-[var(--ozer-accent)]"
          />
          <Button
            type="submit"
            className={cn(marketingBtnGradient, 'min-h-11')}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Saving...' : 'Keep me posted'}
          </Button>
        </div>

        <fieldset className="mt-4">
          <legend className={cn('text-xs font-medium', marketingMutedText)}>
            What should we tell you about?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ITEMS.map((item) => (
              <label
                key={item.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-1.5 text-xs font-medium text-[var(--workspace-shell-text)]"
              >
                <input
                  type="checkbox"
                  checked={interests.includes(item.id)}
                  onChange={() => toggleInterest(item.id)}
                  className="h-3.5 w-3.5 accent-[var(--ozer-accent)]"
                />
                {item.title}
              </label>
            ))}
          </div>
        </fieldset>

        {message ? (
          <p
            className={cn(
              'mt-4 text-sm',
              status === 'error'
                ? 'text-[var(--ozer-coral-600)]'
                : 'text-[var(--workspace-shell-text)]',
            )}
          >
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
