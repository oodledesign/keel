'use client';

import { useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  Briefcase,
  Building2,
  Heart,
  UsersRound,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/workspace-profile';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';

import pathsConfig from '~/config/paths.config';

import {
  completeWorkspaceSetup,
  type WorkspaceSetupSelection,
} from '../_lib/server/workspace-setup.actions';

type DraftWorkspace = {
  id: string;
  profile: WorkspaceProfile;
  name: string;
  enabled: boolean;
  propertyMode?: boolean;
};

const DEFAULT_NAMES: Record<WorkspaceProfile, string> = {
  work_design: 'My Business',
  work_property: 'My Properties',
  family: 'Our Family',
  community: 'Our Group',
};

function newDraft(profile: WorkspaceProfile, propertyMode = false): DraftWorkspace {
  const resolved: WorkspaceProfile =
    profile === 'work_design' && propertyMode ? 'work_property' : profile;
  return {
    id: `${resolved}-${crypto.randomUUID()}`,
    profile: resolved,
    name: DEFAULT_NAMES[resolved],
    enabled: false,
    propertyMode,
  };
}

export function WorkspaceSetupForm() {
  const [drafts, setDrafts] = useState<DraftWorkspace[]>([
    newDraft('work_design'),
    newDraft('family'),
    newDraft('community'),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)),
    );
  };

  const setName = (id: string, name: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name } : d)),
    );
  };

  const setBusinessProperty = (id: string, propertyMode: boolean) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const profile: WorkspaceProfile = propertyMode
          ? 'work_property'
          : 'work_design';
        return {
          ...d,
          propertyMode,
          profile,
          name: d.name === DEFAULT_NAMES.work_design || d.name === DEFAULT_NAMES.work_property
            ? DEFAULT_NAMES[profile]
            : d.name,
        };
      }),
    );
  };

  const submit = () => {
    const selected: WorkspaceSetupSelection[] = drafts
      .filter((d) => d.enabled)
      .map((d) => ({ profile: d.profile, name: d.name.trim() }));

    if (selected.length === 0) {
      setError('Select at least one workspace to continue.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await completeWorkspaceSetup(selected);
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (result?.success) {
          const target = result.redirectTo ?? pathsConfig.app.home;
          // Full navigation so layout guards re-fetch membership state (avoids /setup bounce).
          window.location.assign(target);
          return;
        }
      } catch (e) {
        if (isRedirectError(e)) {
          throw e;
        }
        setError(
          e instanceof Error ? e.message : 'Could not create workspaces.',
        );
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Welcome to Keel
        </h1>
        <p className="text-sm text-zinc-400 md:text-base">
          Let&apos;s set up your workspaces. Pick one or more — you can add more
          later from the workspace menu.
        </p>
      </header>

      <div className="space-y-4">
        {drafts.map((draft) => {
          const isBusiness =
            draft.profile === 'work_design' || draft.profile === 'work_property';
          const color = workspaceColorForSpaceType(
            spaceTypeFromProfile(draft.profile),
          );
          const Icon =
            draft.profile === 'work_property'
              ? Building2
              : draft.profile === 'family'
                ? Heart
                : draft.profile === 'community'
                  ? UsersRound
                  : Briefcase;

          return (
            <div
              key={draft.id}
              className={cn(
                'rounded-2xl border bg-[var(--workspace-shell-panel)] p-4 shadow-[0_18px_50px_rgba(4,10,24,0.24)] transition-colors',
                draft.enabled
                  ? 'border-[var(--keel-teal)]/40 ring-1 ring-[var(--keel-teal)]/25'
                  : 'border-white/[0.08]',
              )}
            >
              <button
                type="button"
                onClick={() => toggle(draft.id)}
                className="flex w-full items-start gap-4 text-left"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {(draft.name[0] ?? 'W').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
                    <span className="text-[15px] font-semibold text-white">
                      {isBusiness
                        ? 'Business'
                        : draft.profile === 'family'
                          ? 'Family'
                          : 'Community'}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-zinc-400">
                    {isBusiness
                      ? 'Manage clients, projects, pipeline and invoicing'
                      : draft.profile === 'family'
                        ? 'Household tasks, calendar and meal planning'
                        : 'Shared tasks, notes and group coordination'}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold',
                    draft.enabled
                      ? 'border-[var(--keel-teal)] bg-[var(--keel-teal)] text-[#060C18]'
                      : 'border-white/20 text-transparent',
                  )}
                  aria-hidden
                >
                  ✓
                </span>
              </button>

              {draft.enabled ? (
                <div className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
                  {isBusiness ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={draft.profile === 'work_property'}
                        onChange={(e) =>
                          setBusinessProperty(draft.id, e.target.checked)
                        }
                        className="rounded border-white/20"
                      />
                      Property — track properties, tenants and maintenance
                    </label>
                  ) : null}
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Workspace name
                    <input
                      value={draft.name}
                      onChange={(e) => setName(draft.id, e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[var(--workspace-shell-canvas)] px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="text-center text-sm text-rose-300">{error}</p>
      ) : null}

      <div className="flex justify-center">
        <Button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="keel-gradient-btn h-11 rounded-xl px-8 text-sm font-semibold"
        >
          {isPending ? 'Creating workspaces…' : 'Get started'}
        </Button>
      </div>
    </div>
  );
}
