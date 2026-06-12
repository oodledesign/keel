import type { PlannerScope } from './types';

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
  const raw = window.localStorage.getItem(planStorageKey(scope, dateYmd));
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
  window.localStorage.setItem(
    planStorageKey(scope, dateYmd),
    JSON.stringify(plan),
  );
}
