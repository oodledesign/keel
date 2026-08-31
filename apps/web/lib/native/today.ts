import 'server-only';

import { loadRecorderToday } from '~/lib/recorder/load-recorder-today';

import { filterRecorderTodayByWorkspace } from './today-filter';
import type { NativeWorkspace } from './workspace-shared';

export { filterRecorderTodayByWorkspace } from './today-filter';

export async function loadNativeToday(
  userId: string,
  workspace: NativeWorkspace,
) {
  const payload = await loadRecorderToday(userId);
  return filterRecorderTodayByWorkspace(payload, workspace);
}
