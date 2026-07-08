import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadPipelineData,
  loadPipelineDataForAccount,
  type PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import {
  loadTasksForTeamAccount,
  loadTasksForUser,
} from '~/home/(user)/_lib/server/tasks.loader';
import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import {
  isWorkModuleEnabled,
  isWorkNavModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '~/home/[account]/_lib/server/workspace-route-guard';
import { getGoogleCalendarConnectionStatus } from '~/lib/integrations/google-calendar/connection';
import { loadPersonalIncludeWorkspaceTasks } from '~/lib/personal-preferences/load-unified-tasks-preference';
import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getSopsDb } from '~/lib/sops/types';

import {
  buildTaskTree,
  filterTasksForIncludeWorkspacePref,
  flattenPlannerTasks,
  tasksDueOnDate,
} from './build-task-tree';
import { plannerScopeKey } from './plan-storage';
import { recommendSopsForTasks } from './sop-recommendations';
import type {
  DayViewData,
  DayViewPipeline,
  PlannerPageData,
  PlannerScope,
  SopSuggestion,
} from './types';

async function loadPlaybooksForAccount(accountId: string) {
  try {
    const db = getSopsDb();
    const { data, error } = await db
      .from('playbooks')
      .select('id, title, description, category')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (error) return [];
    return (data ?? []) as Array<{
      id: string;
      title: string;
      description: string | null;
      category: string | null;
    }>;
  } catch {
    return [];
  }
}

async function loadScopedTasks(
  scope: PlannerScope,
  includeWorkspaceTasks: boolean,
) {
  if (scope.kind === 'personal') {
    const tasks = await loadTasksForUser();
    return filterTasksForIncludeWorkspacePref(tasks, includeWorkspaceTasks);
  }

  if (includeWorkspaceTasks) {
    return loadTasksForUser();
  }

  return loadTasksForTeamAccount(scope.accountId);
}

type PlannerPlanQuery = {
  select: (columns: string) => PlannerPlanQuery;
  eq: (column: string, value: string) => PlannerPlanQuery;
  maybeSingle: () => Promise<{ data: unknown }>;
};

/**
 * Loads the saved day-mode plan for the given scope and date, if one exists.
 * Week plans are skipped: the Today view only renders single-day schedules.
 */
async function loadSavedDayPlanMarkdown(
  client: unknown,
  userId: string,
  scope: PlannerScope,
  dateYmd: string,
): Promise<{ markdown: string; updatedAt: string | null } | null> {
  try {
    const { data } = await (
      client as { from: (name: string) => PlannerPlanQuery }
    )
      .from('planner_plans')
      .select('markdown, mode, updated_at')
      .eq('user_id', userId)
      .eq('scope_key', plannerScopeKey(scope))
      .eq('plan_date', dateYmd)
      .maybeSingle();

    const row = data as {
      markdown?: string | null;
      mode?: string;
      updated_at?: string | null;
    } | null;
    if (!row?.markdown || row.mode !== 'day') return null;
    return {
      markdown: row.markdown,
      updatedAt: row.updated_at ?? null,
    };
  } catch {
    return null;
  }
}

const PIPELINE_OPEN_STAGES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call booked' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'negotiation', label: 'Negotiation' },
];

function summarisePipelineDeals(
  deals: PipelineDeal[],
  href: string,
): DayViewPipeline | null {
  const openKeys = new Set(PIPELINE_OPEN_STAGES.map((s) => s.key));
  const openDeals = deals.filter((deal) => openKeys.has(deal.stage));
  if (openDeals.length === 0) return null;

  const stageLabel = (key: string) =>
    PIPELINE_OPEN_STAGES.find((s) => s.key === key)?.label ?? key;

  const stages = PIPELINE_OPEN_STAGES.map((stage) => {
    const stageDeals = openDeals.filter((deal) => deal.stage === stage.key);
    return {
      key: stage.key,
      label: stage.label,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + deal.value, 0),
    };
  }).filter((stage) => stage.count > 0);

  const today = todayLocalYmd();
  const needsAction = openDeals
    .filter((deal) => deal.nextAction.trim() && deal.nextActionDate)
    .filter((deal) => (deal.nextActionDate as string) <= today)
    .sort((a, b) =>
      (a.nextActionDate as string).localeCompare(b.nextActionDate as string),
    )
    .slice(0, 4)
    .map((deal) => ({
      id: deal.id,
      name:
        [deal.contactName, deal.companyName].filter(Boolean).join(' · ') ||
        'Untitled deal',
      stageLabel: stageLabel(deal.stage),
      nextAction: deal.nextAction,
      nextActionDate: deal.nextActionDate,
      overdue: (deal.nextActionDate as string) < today,
      value: deal.value,
    }));

  return {
    href,
    openCount: openDeals.length,
    openValue: openDeals.reduce((sum, deal) => sum + deal.value, 0),
    stages,
    needsAction,
  };
}

async function loadDayViewPipeline(
  scope: PlannerScope,
): Promise<DayViewPipeline | null> {
  try {
    if (scope.kind === 'personal') {
      const { deals } = await loadPipelineData();
      return summarisePipelineDeals(deals, `${pathsConfig.app.home}/pipeline`);
    }

    const workspace = await loadTeamWorkspace(scope.accountSlug);
    if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
      return null;
    }

    const { deals } = await loadPipelineDataForAccount(scope.accountId);
    return summarisePipelineDeals(
      deals,
      pathsConfig.app.accountPipeline.replace('[account]', scope.accountSlug),
    );
  } catch {
    return null;
  }
}

function sopHref(scope: PlannerScope, playbookId: string) {
  if (scope.kind !== 'workspace') return '#';
  return pathsConfig.app.accountSopsPlaybook
    .replace('[account]', scope.accountSlug)
    .replace('[playbookId]', playbookId);
}

function parseViewDateYmd(dateYmd: string | undefined): string {
  const today = todayLocalYmd();
  if (!dateYmd) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return today;
  const parsed = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return today;
  return dateYmd;
}

async function buildPlannerBundle(
  scope: PlannerScope,
  viewDateYmd?: string,
) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const includeWorkspaceTasks = await loadPersonalIncludeWorkspaceTasks(
    client,
    user.id,
  );
  const planDate = parseViewDateYmd(viewDateYmd);

  const [tasks, calendar, savedPlan] = await Promise.all([
    loadScopedTasks(scope, includeWorkspaceTasks),
    getGoogleCalendarConnectionStatus(client, user.id),
    loadSavedDayPlanMarkdown(client, user.id, scope, planDate),
  ]);

  const taskTree = buildTaskTree(tasks, scope);
  let sopSuggestions: SopSuggestion[] = [];

  if (scope.kind === 'workspace') {
    const playbooks = await loadPlaybooksForAccount(scope.accountId);
    sopSuggestions = recommendSopsForTasks(
      flattenPlannerTasks(taskTree).slice(0, 24),
      playbooks,
      (playbookId) => sopHref(scope, playbookId),
    );
  }

  const dayViewHref =
    scope.kind === 'personal'
      ? pathsConfig.app.personalPlannerDay
      : pathsConfig.app.accountPlannerDay.replace('[account]', scope.accountSlug);

  const planViewHref =
    scope.kind === 'personal'
      ? pathsConfig.app.personalPlanner
      : pathsConfig.app.accountPlanner.replace('[account]', scope.accountSlug);

  const settingsHref = pathsConfig.app.personalAccountSettings;

  return {
    userId: user.id,
    scope,
    includeWorkspaceTasks,
    calendar,
    taskTree,
    sopSuggestions,
    viewDateYmd: planDate,
    savedPlanMarkdown: savedPlan?.markdown ?? null,
    savedPlanUpdatedAt: savedPlan?.updatedAt ?? null,
    dayViewHref,
    planViewHref,
    settingsHref,
  };
}

export const loadPersonalPlannerPageData = cache(async (): Promise<PlannerPageData> =>
  buildPlannerBundle({ kind: 'personal' }),
);

export const loadPersonalDayViewData = cache(
  async (dateYmd?: string): Promise<DayViewData> => {
    const bundle = await buildPlannerBundle({ kind: 'personal' }, dateYmd);
    const viewDateYmd = bundle.viewDateYmd;
    const tasksDueToday = tasksDueOnDate(bundle.taskTree, viewDateYmd);
    const pipeline = await loadDayViewPipeline(bundle.scope);
    const openTasksForReplan = flattenPlannerTasks(bundle.taskTree);

    return {
      userId: bundle.userId,
      scope: bundle.scope,
      includeWorkspaceTasks: bundle.includeWorkspaceTasks,
      calendar: bundle.calendar,
      viewDateYmd,
      tasksDueToday,
      openTasksForReplan,
      sopSuggestions: [],
      planMarkdown: bundle.savedPlanMarkdown,
      planUpdatedAt: bundle.savedPlanUpdatedAt,
      pipeline,
      planViewHref: bundle.planViewHref,
      settingsHref: bundle.settingsHref,
    };
  },
);

export const loadWorkspacePlannerPageData = cache(
  async (accountSlug: string): Promise<PlannerPageData> => {
    const workspace = await loadTeamWorkspace(accountSlug);
    redirectIfSpaceNotIn(
      workspace,
      accountSlug,
      BUSINESS_WORKSPACE_SPACE_TYPES,
    );

    const accountId = workspace.account.id as string;
    const accountName =
      (workspace.account as { name?: string | null }).name?.trim() ||
      accountSlug;

    return buildPlannerBundle({
      kind: 'workspace',
      accountId,
      accountSlug,
      accountName,
    });
  },
);

export const loadWorkspaceDayViewData = cache(
  async (accountSlug: string, dateYmd?: string): Promise<DayViewData> => {
    const workspace = await loadTeamWorkspace(accountSlug);
    redirectIfSpaceNotIn(
      workspace,
      accountSlug,
      BUSINESS_WORKSPACE_SPACE_TYPES,
    );

    const accountId = workspace.account.id as string;
    const accountName =
      (workspace.account as { name?: string | null }).name?.trim() ||
      accountSlug;

    const bundle = await buildPlannerBundle(
      {
        kind: 'workspace',
        accountId,
        accountSlug,
        accountName,
      },
      dateYmd,
    );
    const viewDateYmd = bundle.viewDateYmd;
    const tasksDueToday = tasksDueOnDate(bundle.taskTree, viewDateYmd);
    const pipeline = await loadDayViewPipeline(bundle.scope);
    let sopSuggestions = bundle.sopSuggestions;

    if (bundle.scope.kind === 'workspace') {
      const playbooks = await loadPlaybooksForAccount(bundle.scope.accountId);
      sopSuggestions = recommendSopsForTasks(
        tasksDueToday,
        playbooks,
        (playbookId) => sopHref(bundle.scope, playbookId),
      );
    }

    return {
      userId: bundle.userId,
      scope: bundle.scope,
      includeWorkspaceTasks: bundle.includeWorkspaceTasks,
      calendar: bundle.calendar,
      viewDateYmd,
      tasksDueToday,
      openTasksForReplan: flattenPlannerTasks(bundle.taskTree),
      sopSuggestions,
      planMarkdown: bundle.savedPlanMarkdown,
      planUpdatedAt: bundle.savedPlanUpdatedAt,
      pipeline,
      planViewHref: bundle.planViewHref,
      settingsHref: bundle.settingsHref,
    };
  },
);

export async function assertWorkspacePlannerAccess(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(
    workspace,
    accountSlug,
    BUSINESS_WORKSPACE_SPACE_TYPES,
  );

  const tasksEnabled = isWorkNavModuleEnabled(workspace.moduleSettings, 'tasks');
  if (!tasksEnabled) {
    throw new Error('Tasks module is not enabled for this workspace.');
  }

  return workspace;
}
