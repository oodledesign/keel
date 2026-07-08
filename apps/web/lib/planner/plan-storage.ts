import type { PlannerScope } from './types';
import { parseDayScheduleFromMarkdown } from './parse-plan-markdown';

export type StoredPlan = {
  markdown: string;
  updatedAt: string;
  mode: 'day' | 'week';
};

export function plannerScopeKey(scope: PlannerScope): string {
  return scope.kind === 'personal'
    ? 'personal'
    : `workspace:${scope.accountSlug}`;
}

export function planStorageKey(scope: PlannerScope, dateYmd: string): string {
  return `ozer-planner-plan:${plannerScopeKey(scope)}:${dateYmd}`;
}

/** Legacy key used before Keel → Ozer rename; read for migration only. */
function legacyPlanStorageKey(scope: PlannerScope, dateYmd: string): string {
  return `keel-planner-plan:${plannerScopeKey(scope)}:${dateYmd}`;
}

export function toLocalDateYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadStoredPlan(
  scope: PlannerScope,
  dateYmd: string,
): StoredPlan | null {
  if (typeof window === 'undefined') return null;
  const raw =
    window.localStorage.getItem(planStorageKey(scope, dateYmd)) ??
    window.localStorage.getItem(legacyPlanStorageKey(scope, dateYmd));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlan;
  } catch {
    return null;
  }
}

export function saveStoredPlan(
  scope: PlannerScope,
  dateYmd: string,
  plan: StoredPlan,
): void {
  if (typeof window === 'undefined') return;
  const key = planStorageKey(scope, dateYmd);
  window.localStorage.setItem(key, JSON.stringify(plan));
  // Prefer ozer- keys going forward; drop legacy copy if present.
  window.localStorage.removeItem(legacyPlanStorageKey(scope, dateYmd));
}

function scheduleBlockCount(markdown: string, dateIso: string): number {
  return parseDayScheduleFromMarkdown(markdown, dateIso).length;
}

/** Prefer the plan that parses to the most schedule blocks, then the newest copy. */
export function pickBestPlanMarkdown(
  serverMarkdown: string | null | undefined,
  serverUpdatedAt: string | null | undefined,
  stored: StoredPlan | null,
  dateYmd: string,
): string {
  const serverMd = serverMarkdown?.trim() ?? '';
  const storedMd = stored?.markdown?.trim() ?? '';
  if (!serverMd) return storedMd;
  if (!storedMd) return serverMd;

  const dateIso = `${dateYmd}T12:00:00`;
  const serverBlocks = scheduleBlockCount(serverMd, dateIso);
  const storedBlocks = scheduleBlockCount(storedMd, dateIso);

  if (storedBlocks > serverBlocks) return storedMd;
  if (serverBlocks > storedBlocks) return serverMd;

  const serverTime = serverUpdatedAt ? Date.parse(serverUpdatedAt) : 0;
  const storedTime =
    stored?.updatedAt && Number.isFinite(Date.parse(stored.updatedAt))
      ? Date.parse(stored.updatedAt)
      : 0;
  if (Number.isFinite(storedTime) && storedTime > serverTime) return storedMd;

  return serverMd;
}
