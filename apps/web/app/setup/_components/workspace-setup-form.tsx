'use client';

import { useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  Briefcase,
  Building2,
  ClipboardCheck,
  Heart,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/workspace-profile';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import {
  MARKETING_WORKSPACE_PLANS,
  type SetupIntent,
  formatGbp,
} from '~/lib/billing/pricing-marketing';

import {
  type WorkspaceSetupSelection,
  completeWorkspaceSetup,
} from '../_lib/server/workspace-setup.actions';

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
  commercial_property: 'Commercial Property',
  building_surveyor: 'Building Surveyor',
  family: 'Our Family',
  community: 'Our Group',
};

function planPriceGbp(productId: string) {
  return (
    MARKETING_WORKSPACE_PLANS.find((plan) => plan.productId === productId)
      ?.monthlyPriceGbp ?? null
  );
}

const BUSINESS_SEAT1_PRICE = estimateMonthlyGbp(1);
const PROPERTY_PRICE = planPriceGbp('ozer-property-starter');
const COMMERCIAL_PRICE = planPriceGbp('ozer-commercial-property');
const COMMUNITY_PRICE = planPriceGbp('ozer-community');

function businessCardBlurb(fullBusinessMode: boolean, propertyMode: boolean) {
  if (propertyMode) {
    const price =
      PROPERTY_PRICE != null ? `From ${formatGbp(PROPERTY_PRICE)}/mo — ` : '';
    return `${price}properties, tenants & maintenance`;
  }
  if (fullBusinessMode) {
    return `Business from ${formatGbp(BUSINESS_SEAT1_PRICE)}/mo — clients, projects & invoices`;
  }
  return 'Lite (free) for apps — or enable full CRM below (Business)';
}

function commercialCardBlurb() {
  const price =
    COMMERCIAL_PRICE != null ? `From ${formatGbp(COMMERCIAL_PRICE)}/mo — ` : '';
  return `${price}disposals, requirements, viewings & Property Hive sync`;
}

function communityCardBlurb() {
  const price =
    COMMUNITY_PRICE != null ? `From ${formatGbp(COMMUNITY_PRICE)}/mo — ` : '';
  return `${price}shared schedule, tasks and notes`;
}

function newDraft(
  profile: WorkspaceProfile,
  propertyMode = false,
): DraftWorkspace {
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
    newDraft('commercial_property'),
    newDraft('building_surveyor'),
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

  const selectedCount = drafts.filter((d) => d.enabled).length;
  const hasBillingIntent = Boolean(
    props.intent?.productId && props.intent.planId,
  );

  const toggle = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)),
    );
  };

  const setName = (id: string, name: string) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
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
          name:
            d.name === DEFAULT_NAMES.work_design ||
            d.name === DEFAULT_NAMES.work_property
              ? DEFAULT_NAMES[profile]
              : d.name,
        };
      }),
    );
  };

  const runSetup = (
    selected: WorkspaceSetupSelection[],
    skipTeamWorkspaces = false,
  ) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await completeWorkspaceSetup(selected, {
          skipTeamWorkspaces,
          billingIntent:
            !skipTeamWorkspaces &&
            props.intent?.productId &&
            props.intent.planId
              ? {
                  productId: props.intent.productId,
                  planId: props.intent.planId,
                  interval: props.intent.interval,
                  seats: props.intent.seats,
                }
              : undefined,
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (result?.success) {
          const target = result.redirectTo ?? pathsConfig.app.home;
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

  const skipToPersonal = () => {
    runSetup([], true);
  };

  const submitSelected = () => {
    const selected: WorkspaceSetupSelection[] = drafts
      .filter((d) => d.enabled)
      .map((d) => ({
        profile: d.profile,
        name: d.name.trim(),
        businessMode:
          d.profile === 'work_design' && d.fullBusinessMode ? 'full' : 'lite',
      }));

    if (selected.length === 0) {
      setError('Select at least one workspace, or continue with personal.');
      return;
    }

    runSetup(selected);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-3xl">
          Your personal account is ready
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--workspace-shell-text-muted)] md:text-base">
          Continue with your free personal hub — perfect if you were invited to
          a project — or add another workspace for business, family, or
          community. You can always add more later.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)] lg:sticky lg:top-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ozer-accent)]/15 text-[var(--ozer-accent)]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
                Continue with free personal
              </h2>
              <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
                Skip other workspaces for now. Open your personal hub — and any
                project you were invited to — without setting up a studio or
                team account.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <li>• Tasks, notes, and planner stay on your personal account</li>
            <li>• Guest project invites work without creating a workspace</li>
            <li>• Add Business, Family, or Community anytime later</li>
          </ul>

          <Button
            type="button"
            disabled={isPending}
            onClick={skipToPersonal}
            className="ozer-gradient-btn mt-6 h-11 w-full rounded-xl text-sm font-semibold"
          >
            {isPending ? 'Continuing…' : 'Continue with free personal'}
          </Button>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              Or add another workspace
            </h2>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Optional. Select one or more to create now.
            </p>
            {hasBillingIntent ? (
              <p className="text-sm text-[var(--ozer-accent)]">
                {props.intent?.productId === 'ozer-business'
                  ? 'Recommended: Business (14-day trial).'
                  : props.intent?.productId === 'ozer-business-lite'
                    ? 'Next: free Business Lite for apps.'
                    : 'Your selected plan will open after you create the workspace.'}
              </p>
            ) : null}
          </div>

          {drafts.map((draft) => {
            const isBusiness =
              draft.profile === 'work_design' ||
              draft.profile === 'work_property';
            const isCommercial = draft.profile === 'commercial_property';
            const isSurveyor = draft.profile === 'building_surveyor';
            const color = workspaceColorForSpaceType(
              spaceTypeFromProfile(draft.profile),
            );
            const Icon =
              draft.profile === 'work_property' || isCommercial
                ? Building2
                : isSurveyor
                  ? ClipboardCheck
                  : draft.profile === 'family'
                    ? Heart
                    : draft.profile === 'community'
                      ? UsersRound
                      : Briefcase;

            return (
              <div
                key={draft.id}
                className={cn(
                  'rounded-2xl border bg-[var(--workspace-shell-panel)] p-4 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)] transition-colors',
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
                      <Icon
                        className="h-4 w-4 text-[var(--workspace-shell-text-muted)]"
                        aria-hidden
                      />
                      <span className="text-[15px] font-semibold text-[var(--workspace-shell-text)]">
                        {isBusiness
                          ? 'Business'
                          : isCommercial
                            ? 'Commercial Property'
                            : isSurveyor
                              ? 'Building Surveyor'
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
                        : isCommercial
                          ? commercialCardBlurb()
                          : isSurveyor
                            ? 'Enquiry → booking → building survey reports from site transcripts'
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
                            Full business — clients, jobs, invoices
                            {` · 14-day trial from ${formatGbp(BUSINESS_SEAT1_PRICE)}/mo`}
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="block text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
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

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button
            type="button"
            disabled={isPending || selectedCount === 0}
            onClick={submitSelected}
            variant="outline"
            className="h-11 w-full rounded-xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm font-semibold text-[var(--workspace-shell-text)]"
          >
            {isPending
              ? 'Creating…'
              : props.intent?.productId &&
                  props.intent.productId !== 'ozer-business-lite' &&
                  drafts.some((d) => d.enabled && d.fullBusinessMode)
                ? 'Create workspace & start trial'
                : selectedCount > 0
                  ? `Create selected workspace${selectedCount === 1 ? '' : 's'}`
                  : 'Select a workspace to create'}
          </Button>
        </section>
      </div>
    </div>
  );
}
