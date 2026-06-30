'use client';

import { useState } from 'react';

import { Briefcase, Heart, UsersRound } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { upsertUserSettings } from '~/onboarding/_lib/server/onboarding.actions';

const options = [
  {
    key: 'use_keel_for_work' as const,
    title: 'Work',
    description: 'Trade, clients, jobs, and billing.',
    Icon: Briefcase,
  },
  {
    key: 'use_keel_for_family' as const,
    title: 'Family',
    description: 'Household and shared life admin.',
    Icon: Heart,
  },
  {
    key: 'use_keel_for_community' as const,
    title: 'Community groups',
    description: 'Clubs, volunteers, and local groups.',
    Icon: UsersRound,
  },
];

export function KeelUsePreferencesForm(props: {
  initial: {
    use_keel_for_work: boolean;
    use_keel_for_family: boolean;
    use_keel_for_community: boolean;
  };
}) {
  const [work, setWork] = useState(props.initial.use_keel_for_work);
  const [family, setFamily] = useState(props.initial.use_keel_for_family);
  const [community, setCommunity] = useState(
    props.initial.use_keel_for_community,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const values = {
    use_keel_for_work: work,
    use_keel_for_family: family,
    use_keel_for_community: community,
  };

  const setters = {
    use_keel_for_work: setWork,
    use_keel_for_family: setFamily,
    use_keel_for_community: setCommunity,
  };

  const handleSave = async () => {
    setPending(true);
    setMessage(null);
    const result = await upsertUserSettings(values);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage('Saved.');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          How you use Ozer
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Shared spaces (optional) are for when you organise with others — work
          crews, family, or community groups. This only affects what we
          prioritise for you.
        </p>
      </div>

      <div className="grid gap-3">
        {options.map(({ key, title, description, Icon }) => {
          const on = values[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setters[key](!on)}
              className={cn(
                'flex w-full items-start gap-4 rounded-2xl border px-4 py-3 text-left transition-colors',
                'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
                on
                  ? 'border-[var(--ozer-accent)]/40 ring-1 ring-[var(--ozer-accent)]/25'
                  : 'hover:border-[color:var(--workspace-shell-border)]',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  on ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]' : 'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[var(--workspace-shell-text)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--workspace-shell-text-muted)]">
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="bg-[var(--ozer-accent)] text-[#060C18] hover:bg-[var(--ozer-accent)]/90"
        >
          {pending ? 'Saving…' : 'Save preferences'}
        </Button>
        {message ? (
          <span
            className={
              message === 'Saved.'
                ? 'text-sm text-[var(--ozer-accent)]'
                : 'text-sm text-amber-400'
            }
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
