import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { timeOfDayGreeting } from '~/lib/time-of-day-greeting';

import { getNativeFinances } from './invoices';
import { workspaceShowsNativeInvoices } from './invoices-shared';
import { listNativeNotes } from './notes';
import { listNativeTasks } from './tasks';
import {
  type NativeTodayHomePayload,
  buildNativeTodayHomePayload,
  nativeTodayDateParts,
  pickNativeTodayNotes,
  splitNativeTodayTasks,
} from './today-home';
import type { NativeWorkspace } from './workspace-shared';

export { filterRecorderTodayByWorkspace } from './today-filter';
export {
  buildNativeTodayHomePayload,
  mergeNativeTodayItems,
  nativeTodayDateParts,
  pickNativeTodayNotes,
  splitNativeTodayTasks,
} from './today-home';
export type { NativeTodayHomePayload } from './today-home';

export async function loadNativeToday(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
): Promise<NativeTodayHomePayload> {
  const { date, date_label } = nativeTodayDateParts();
  const [openTasks, notes, finances] = await Promise.all([
    listNativeTasks(client, userId, workspace, { status: 'open' }),
    listNativeNotes(userId, workspace),
    workspaceShowsNativeInvoices(workspace.profile)
      ? getNativeFinances(client, workspace)
      : Promise.resolve(null),
  ]);

  const { dueToday, overdue } = splitNativeTodayTasks(openTasks, date);
  const { recentNotes, meetingsToday } = pickNativeTodayNotes(notes, date);

  return buildNativeTodayHomePayload({
    greeting: timeOfDayGreeting(),
    date,
    dateLabel: date_label,
    dueToday,
    overdue,
    recentNotes,
    meetingsToday,
    finances,
  });
}
