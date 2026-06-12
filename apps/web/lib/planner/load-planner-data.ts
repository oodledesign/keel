import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadTasksForTeamAccount,
  loadTasksForUser,
} from '~/home/(user)/_lib/server/tasks.loader';
import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { isWorkNavModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
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
import type { DayViewData, PlannerPageData, PlannerScope, SopSuggestion } from './types';

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
): Promise<string | null> {
  try {
    const { data } = await (
      client as { from: (name: string) => PlannerPlanQuery }
    )
      .from('planner_plans')
      .select('markdown, mode')
      .eq('user_id', userId)
      .eq('scope_key', plannerScopeKey(scope))
      .eq('plan_date', dateYmd)
      .maybeSingle();

    const row = data as { markdown?: string | null; mode?: string } | null;
    if (!row?.markdown || row.mode !== 'day') return null;
    return row.markdown;
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

async function buildPlannerBundle(scope: PlannerScope) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const includeWorkspaceTasks = await loadPersonalIncludeWorkspaceTasks(
    client,
    user.id,
  );

  const [tasks, calendar, savedPlanMarkdown] = await Promise.all([
    loadScopedTasks(scope, includeWorkspaceTasks),
    getGoogleCalendarConnectionStatus(client, user.id),
    loadSavedDayPlanMarkdown(client, user.id, scope, todayLocalYmd()),
  ]);

  const taskTree = buildTaskTree(tasks);
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
    savedPlanMarkdown,
    dayViewHref,
    planViewHref,
    settingsHref,
  };
}

export const loadPersonalPlannerPageData = cache(async (): Promise<PlannerPageData> =>
  buildPlannerBundle({ kind: 'personal' }),
);

export const loadPersonalDayViewData = cache(async (): Promise<DayViewData> => {
  const bundle = await buildPlannerBundle({ kind: 'personal' });
  const tasksDueToday = tasksDueOnDate(bundle.taskTree, todayLocalYmd());

  return {
    userId: bundle.userId,
    scope: bundle.scope,
    includeWorkspaceTasks: bundle.includeWorkspaceTasks,
    calendar: bundle.calendar,
    tasksDueToday,
    sopSuggestions: [],
    planMarkdown: bundle.savedPlanMarkdown,
    planViewHref: bundle.planViewHref,
    settingsHref: bundle.settingsHref,
  };
});

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
  async (accountSlug: string): Promise<DayViewData> => {
    const bundle = await loadWorkspacePlannerPageData(accountSlug);
    const tasksDueToday = tasksDueOnDate(bundle.taskTree, todayLocalYmd());
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
      tasksDueToday,
      sopSuggestions,
      planMarkdown: bundle.savedPlanMarkdown,
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
