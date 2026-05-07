import type { TaskAssignmentOption } from '../../_lib/actions/task-actions';

export type ProjectGroup = {
  key: string;
  label: string;
  projects: TaskAssignmentOption[];
};

/** Group projects by team account for the personal Add/Edit task pickers. */
export function groupProjectsByWorkspace(
  projects: TaskAssignmentOption[],
): ProjectGroup[] {
  const buckets = new Map<
    string,
    { label: string; projects: TaskAssignmentOption[] }
  >();

  for (const p of projects) {
    const key = p.accountId ?? '__no_account__';
    const label =
      p.accountName?.trim() ||
      (p.accountId ? 'Team workspace' : 'Other workspace');

    if (!buckets.has(key)) {
      buckets.set(key, { label, projects: [] });
    }
    buckets.get(key)!.projects.push(p);
  }

  for (const b of buckets.values()) {
    b.projects.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  return [...buckets.entries()]
    .map(([key, { label, projects: plist }]) => ({
      key,
      label,
      projects: plist,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
}
