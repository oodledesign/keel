import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import type { IgStepType } from '~/lib/instagram-autoreply/sequence/step-types';
import {
  workspaceBorder,
  workspaceFilterActive,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  STEP_TYPE_LABELS,
  TRIGGER_TYPE_LABELS,
} from '../../(instagram-autoreply)/_components/builder/builder-model';
import { InstagramSubnav } from '../../(instagram-autoreply)/_components/instagram-subnav';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

const RANGES = [7, 30, 90] as const;

type Metric = 'triggered' | 'completed' | 'sent' | 'tapped' | 'collected';

type Funnel = {
  triggered: number;
  tapped: number;
  collected: number;
  completed: number;
  sentByStep: Map<number, number>;
};

type InstagramAnalyticsPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ days?: string }>;
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function emptyFunnel(): Funnel {
  return {
    triggered: 0,
    tapped: 0,
    collected: 0,
    completed: 0,
    sentByStep: new Map(),
  };
}

function percent(part: number, whole: number) {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

function FunnelBar(props: { label: string; value: number; base: number }) {
  const width = props.base
    ? Math.max(2, Math.round((props.value / props.base) * 100))
    : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={workspaceTextMuted}>{props.label}</span>
        <span className={workspaceText}>
          {props.value.toLocaleString('en-GB')}
          <span className={`ml-2 text-xs ${workspaceTextMuted}`}>
            {percent(props.value, props.base)}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
        <div
          className="h-full rounded-full bg-[var(--ozer-accent)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default async function InstagramAnalyticsPage({
  params,
  searchParams,
}: InstagramAnalyticsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const days = RANGES.find((d) => String(d) === sp.days) ?? 30;
  const since = daysAgo(days);

  const [funnelRes, triggersRes, stepsRes] = await Promise.all([
    client.rpc('ig_automation_funnel', {
      p_account_id: accountId,
      p_since: since.toISOString(),
    }),
    client
      .from('ig_triggers')
      .select('id, name, trigger_type, is_active')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
    client
      .from('ig_automation_steps')
      .select('trigger_id, position, step_type')
      .eq('account_id', accountId),
  ]);
  if (funnelRes.error) throw new Error(funnelRes.error.message);
  if (triggersRes.error) throw new Error(triggersRes.error.message);

  const funnels = new Map<string, Funnel>();
  const totals = emptyFunnel();
  let totalSent = 0;

  for (const row of funnelRes.data ?? []) {
    const funnel = funnels.get(row.trigger_id) ?? emptyFunnel();
    funnels.set(row.trigger_id, funnel);
    const count = Number(row.count);
    const metric = row.metric as Metric;
    if (metric === 'sent') {
      funnel.sentByStep.set(
        row.step_position,
        (funnel.sentByStep.get(row.step_position) ?? 0) + count,
      );
      totalSent += count;
    } else {
      funnel[metric] += count;
      totals[metric] += count;
    }
  }

  const stepTypes = new Map<string, IgStepType>();
  for (const step of stepsRes.data ?? []) {
    stepTypes.set(
      `${step.trigger_id}:${step.position}`,
      step.step_type as IgStepType,
    );
  }

  const triggers = (triggersRes.data ?? []).filter(
    (t) => funnels.has(t.id) || t.is_active,
  );
  const analyticsPath =
    pathsConfig.app.accountInstagramAutoreplyAnalytics.replace(
      '[account]',
      account,
    );

  const summary = [
    { label: 'Automations triggered', value: totals.triggered },
    { label: 'Messages sent', value: totalSent },
    { label: 'Button taps', value: totals.tapped },
    { label: 'Details collected', value: totals.collected },
    { label: 'Completed', value: totals.completed },
  ];

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram analytics"
        description="How people move through each automation. Test sends aren't counted."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />

        <div className="mx-4 flex gap-2 lg:mx-0">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`${analyticsPath}?days=${range}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                range === days ? workspaceFilterActive : workspaceTextMuted
              }`}
            >
              Last {range} days
            </Link>
          ))}
        </div>

        <div className="mx-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mx-0 lg:grid-cols-5">
          {summary.map((item) => (
            <div key={item.label} className={`${workspacePanelCard} p-4`}>
              <p className={`text-xs ${workspaceTextMuted}`}>{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${workspaceText}`}>
                {item.value.toLocaleString('en-GB')}
              </p>
            </div>
          ))}
        </div>

        {triggers.length === 0 ? (
          <p className={`mx-4 text-sm lg:mx-0 ${workspaceTextMuted}`}>
            No automation activity in the last {days} days.
          </p>
        ) : (
          <div className="mx-4 grid gap-4 lg:mx-0 xl:grid-cols-2">
            {triggers.map((trigger) => {
              const funnel = funnels.get(trigger.id) ?? emptyFunnel();
              const sent = [...funnel.sentByStep.entries()].sort(
                (a, b) => a[0] - b[0],
              );
              return (
                <section
                  key={trigger.id}
                  className={`${workspacePanelCard} space-y-4 p-5`}
                >
                  <header>
                    <h2 className={`font-semibold ${workspaceText}`}>
                      {trigger.name}
                    </h2>
                    <p className={`text-xs ${workspaceTextMuted}`}>
                      {TRIGGER_TYPE_LABELS[
                        trigger.trigger_type as keyof typeof TRIGGER_TYPE_LABELS
                      ] ?? 'Comment keyword'}
                      {trigger.is_active ? '' : ' · Paused'}
                    </p>
                  </header>

                  <div className="space-y-3">
                    <FunnelBar
                      label="Triggered"
                      value={funnel.triggered}
                      base={funnel.triggered}
                    />
                    <FunnelBar
                      label="Tapped a button"
                      value={funnel.tapped}
                      base={funnel.triggered}
                    />
                    <FunnelBar
                      label="Shared details"
                      value={funnel.collected}
                      base={funnel.triggered}
                    />
                    <FunnelBar
                      label="Completed"
                      value={funnel.completed}
                      base={funnel.triggered}
                    />
                  </div>

                  {sent.length ? (
                    <div className={`border-t pt-3 ${workspaceBorder}`}>
                      <p
                        className={`mb-2 text-xs font-medium ${workspaceTextMuted}`}
                      >
                        Messages sent by step
                      </p>
                      <ul className="space-y-1 text-sm">
                        {sent.map(([position, count]) => {
                          const type = stepTypes.get(
                            `${trigger.id}:${position}`,
                          );
                          return (
                            <li
                              key={position}
                              className="flex justify-between gap-2"
                            >
                              <span className={workspaceTextMuted}>
                                {position < 0
                                  ? 'Other messages'
                                  : `Step ${position + 1}${type ? ` · ${STEP_TYPE_LABELS[type]}` : ''}`}
                              </span>
                              <span className={workspaceText}>
                                {count.toLocaleString('en-GB')}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
