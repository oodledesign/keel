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
import {
  formatGbp,
  MARKETING_WORKSPACE_PLANS,
  type SetupIntent,
} from '~/lib/billing/pricing-marketing';

type DraftWorkspace = {
  id: string;
  profile: WorkspaceProfile;
  name: string;
  enabled: boolean;
  propertyMode?: boolean;
  fullBusinessMode?: boolean;
};

const DEFAULT_NAMES: Record<WorkspaceProfile, string> = {
  work_design: 'My Business',
  work_property: 'My Properties',
  family: 'Our Family',
  community: 'Our Group',
};

function planPriceGbp(productId: string) {
  return (
    MARKETING_WORKSPACE_PLANS.find((plan) => plan.productId === productId)
      ?.monthlyPriceGbp ?? null
  );
}

const SOLO_PRICE = planPriceGbp('ozer-business-solo');
const TEAM_PRICE = planPriceGbp('ozer-business-team');
const PROPERTY_PRICE = planPriceGbp('ozer-property-starter');
const COMMUNITY_PRICE = planPriceGbp('ozer-community');

function businessCardBlurb(fullBusinessMode: boolean, propertyMode: boolean) {
  if (propertyMode) {
    const price =
      PROPERTY_PRICE != null ? `From ${formatGbp(PROPERTY_PRICE)}/mo — ` : '';
    return `${price}properties, tenants & maintenance`;
  }
  if (fullBusinessMode) {
    const solo =
      SOLO_PRICE != null ? `Solo from ${formatGbp(SOLO_PRICE)}/mo` : 'Solo';
    const team =
      TEAM_PRICE != null ? `Team from ${formatGbp(TEAM_PRICE)}/mo` : 'Team';
    return `${solo} · ${team} — clients, projects & invoices`;
  }
  return 'Lite (free) for apps — or enable full CRM below (Solo / Team)';
}

function communityCardBlurb() {
  const price =
    COMMUNITY_PRICE != null ? `From ${formatGbp(COMMUNITY_PRICE)}/mo — ` : '';
  return `${price}shared schedule, tasks and notes`;
}

function newDraft(profile: WorkspaceProfile, propertyMode = false): DraftWorkspace {
  const resolved: WorkspaceProfile =
    profile === 'work_design' && propertyMode ? 'work_property' : profile;
  return {
    id: `${resolved}-${crypto.randomUUID()}`,
    profile: resolved,
    name: DEFAULT_NAMES[resolved],
    enabled: false,
    propertyMode,
    fullBusinessMode: false,
  };
}

function initialDrafts(intent?: SetupIntent): DraftWorkspace[] {
  const drafts: DraftWorkspace[] = [
    newDraft('work_design'),
    newDraft('family'),
    newDraft('community'),
  ];

  if (!intent?.profile) {
    return drafts;
  }

  if (intent.profile === 'work_property') {
    return drafts.map((draft) =>
      draft.profile === 'work_design'
        ? {
            ...draft,
            enabled: true,
            propertyMode: true,
            profile: 'work_property',
            name: DEFAULT_NAMES.work_property,
          }
        : draft,
    );
  }

  return drafts.map((draft) =>
    draft.profile === intent.profile
      ? {
          ...draft,
          enabled: true,
          fullBusinessMode:
            intent.profile === 'work_design' &&
            Boolean(intent.productId?.startsWith('ozer-business-')) &&
            intent.productId !== 'ozer-business-lite',
        }
      : draft,
  );
}

export function WorkspaceSetupForm(props: { intent?: SetupIntent }) {
  const [drafts, setDrafts] = useState<DraftWorkspace[]>(() =>
    initialDrafts(props.intent),
  );
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
      .map((d) => ({
        profile: d.profile,
        name: d.name.trim(),
        businessMode:
          d.profile === 'work_design' && d.fullBusinessMode ? 'full' : 'lite',
      }));

    if (selected.length === 0) {
      setError('Select at least one workspace to continue.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await completeWorkspaceSetup(selected, {
          billingIntent:
            props.intent?.productId && props.intent.planId
              ? {
                  productId: props.intent.productId,
                  planId: props.intent.planId,
                  interval: props.intent.interval,
                }
              : undefined,
        });
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
        <h1 className="text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-3xl">
          Your personal account is ready
        </h1>
        <p className="text-sm text-[var(--workspace-shell-text-muted)] md:text-base">
          Add a workspace for the studio — or skip and explore your personal hub
          first. You can always add more later.
        </p>
        {props.intent?.productId === 'ozer-business-solo' ? (
          <p className="text-sm text-[var(--ozer-accent)]">
            Recommended: Business Solo (14-day trial) — clients, projects &amp;
            invoices for one person.
          </p>
        ) : props.intent?.productId === 'ozer-business-team' ? (
          <p className="text-sm text-[var(--ozer-accent)]">
            Recommended: Business Team (14-day trial) — shared clients &amp;
            projects for up to five people.
          </p>
        ) : props.intent?.productId === 'ozer-business-lite' ? (
          <p className="text-sm text-[var(--ozer-accent)]">
            Next: free Business Lite for apps. Switch to Solo or Team when you
            need clients, projects, and invoices.
          </p>
        ) : props.intent?.productId && props.intent.planId ? (
          <p className="text-sm text-[var(--ozer-accent)]">
            Your selected plan will open after you create the workspace.
          </p>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Most freelancers pick Solo; small studios pick Team.
          </p>
        )}
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
                  ? 'border-[var(--ozer-accent)]/40 ring-1 ring-[var(--ozer-accent)]/25'
                  : 'border-[color:var(--workspace-shell-border)]',
              )}
            >
              <button
                type="button"
                onClick={() => toggle(draft.id)}
                className="flex w-full items-start gap-4 text-left"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[var(--workspace-shell-text)]"
                  style={{ backgroundColor: color }}
                >
                  {(draft.name[0] ?? 'W').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" aria-hidden />
                    <span className="text-[15px] font-semibold text-[var(--workspace-shell-text)]">
                      {isBusiness
                        ? 'Business'
                        : draft.profile === 'family'
                          ? 'Family'
                          : 'Community'}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-[var(--workspace-shell-text-muted)]">
                    {isBusiness
                      ? businessCardBlurb(
                          !!draft.fullBusinessMode,
                          draft.profile === 'work_property',
                        )
                      : draft.profile === 'family'
                        ? 'Free — household tasks, calendar and meal planning'
                        : communityCardBlurb()}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold',
                    draft.enabled
                      ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[#060C18]'
                      : 'border-[color:var(--workspace-shell-border)] text-transparent',
                  )}
                  aria-hidden
                >
                  ✓
                </span>
              </button>

              {draft.enabled ? (
                <div className="mt-4 space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
                  {isBusiness ? (
                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
                        <input
                          type="checkbox"
                          checked={draft.profile === 'work_property'}
                          onChange={(e) =>
                            setBusinessProperty(draft.id, e.target.checked)
                          }
                          className="rounded border-[color:var(--workspace-shell-border)]"
                        />
                        Property — track properties, tenants and maintenance
                      </label>
                      {draft.profile === 'work_design' ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
                          <input
                            type="checkbox"
                            checked={!!draft.fullBusinessMode}
                            onChange={(e) =>
                              setDrafts((prev) =>
                                prev.map((d) =>
                                  d.id === draft.id
                                    ? {
                                        ...d,
                                        fullBusinessMode: e.target.checked,
                                      }
                                    : d,
                                ),
                              )
                            }
                            className="rounded border-[color:var(--workspace-shell-border)]"
                          />
                          Full business (Solo / Team) — clients, jobs, invoices
                          {SOLO_PRICE != null
                            ? ` · 14-day trial from ${formatGbp(SOLO_PRICE)}/mo`
                            : ' · 14-day trial'}
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                    Workspace name
                    <input
                      value={draft.name}
                      onChange={(e) => setName(draft.id, e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 text-sm text-[var(--workspace-shell-text)] focus:border-[color:var(--workspace-shell-border)] focus:outline-none"
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

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="ozer-gradient-btn h-11 rounded-xl px-8 text-sm font-semibold"
        >
          {isPending
            ? 'Creating…'
            : props.intent?.productId &&
                props.intent.productId !== 'ozer-business-lite' &&
                drafts.some((d) => d.enabled && d.fullBusinessMode)
              ? 'Create workspace & start trial'
              : 'Create selected workspaces'}
        </Button>
        <p className="max-w-md text-center text-xs text-[var(--workspace-shell-text-muted)]">
          Your free personal account is already set. Workspaces are optional
          extras for business, family, or community.
        </p>
      </div>
    </div>
  );
}
