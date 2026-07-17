'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  deleteGoogleCalendarConnection,
  updateGoogleCalendarSelection,
} from '~/lib/integrations/google-calendar/connection';
import {
  type AccountTaskAutomationSettings,
  upsertAccountTaskAutomationSettings,
} from '~/lib/recorder/task-automation-settings';

function revalidateTaskAutomationSurfaces(accountSlug: string) {
  const slug = accountSlug.trim();
  if (!slug) return;

  revalidatePath(
    workAccountPath(pathsConfig.app.accountTaskAutomationSettings, slug),
    'page',
  );
  revalidatePath(
    workAccountPath(pathsConfig.app.accountTasksReview, slug),
    'page',
  );
  revalidatePath(
    workAccountPath(pathsConfig.app.accountSchedulingAccounts, slug),
    'page',
  );
  revalidatePath(`/home/${slug}/settings/task-automation`, 'page');
  revalidatePath(`/home/${slug}/tasks/review`, 'page');
  revalidatePath(`/home/${slug}/scheduling/accounts`, 'page');
}

async function assertWorkspaceMember(accountId: string, userId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('You do not have access to this workspace');
  }
}

const saveSettingsSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  meetingTasksMode: z.enum(['auto_publish', 'requires_moderation']),
  emailTasksMode: z.enum(['auto_publish', 'requires_moderation']),
  autoScheduleOnCalendar: z.boolean(),
  calendarLeadTimeMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  excludePersonalCalendarBusy: z.boolean(),
});

export const saveAccountTaskAutomationSettingsAction = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const startMinutes =
      Number(input.workingHoursStart.slice(0, 2)) * 60 +
      Number(input.workingHoursStart.slice(3, 5));
    const endMinutes =
      Number(input.workingHoursEnd.slice(0, 2)) * 60 +
      Number(input.workingHoursEnd.slice(3, 5));

    if (endMinutes <= startMinutes) {
      throw new Error('Working hours end must be after start');
    }

    const client = getSupabaseServerClient();
    const settings: AccountTaskAutomationSettings = {
      accountId: input.accountId,
      meetingTasksMode: input.meetingTasksMode,
      emailTasksMode: input.emailTasksMode,
      autoScheduleOnCalendar: input.autoScheduleOnCalendar,
      calendarLeadTimeMinutes: input.calendarLeadTimeMinutes,
      workingHoursStart: input.workingHoursStart,
      workingHoursEnd: input.workingHoursEnd,
      excludePersonalCalendarBusy: input.excludePersonalCalendarBusy,
    };

    await upsertAccountTaskAutomationSettings(client, settings);
    revalidateTaskAutomationSurfaces(input.accountSlug);

    return settings;
  },
  { schema: saveSettingsSchema },
);

const saveCalendarSelectionSchema = z.object({
  accountSlug: z.string().min(1),
  selections: z.array(
    z.object({
      connectionId: z.string().uuid(),
      busyCalendarIds: z.array(z.string().min(1)),
      personalCalendarIds: z.array(z.string().min(1)),
    }),
  ),
});

export const saveGoogleCalendarSelectionAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    for (const selection of input.selections) {
      await updateGoogleCalendarSelection(client, {
        userId: user.id,
        connectionId: selection.connectionId,
        busyCalendarIds: selection.busyCalendarIds,
        personalCalendarIds: selection.personalCalendarIds,
      });
    }

    revalidateTaskAutomationSurfaces(input.accountSlug);
    return { success: true as const };
  },
  { schema: saveCalendarSelectionSchema },
);

const disconnectCalendarSchema = z.object({
  accountSlug: z.string().min(1),
  connectionId: z.string().uuid().optional(),
});

export const disconnectGoogleCalendarFromWorkspaceAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    await deleteGoogleCalendarConnection(client, {
      userId: user.id,
      connectionId: input.connectionId,
    });

    revalidateTaskAutomationSurfaces(input.accountSlug);
    revalidatePath(pathsConfig.app.personalAccountIntegrationsSettings, 'page');
    revalidatePath(pathsConfig.app.personalPlanner, 'page');

    return { success: true as const };
  },
  { schema: disconnectCalendarSchema },
);
