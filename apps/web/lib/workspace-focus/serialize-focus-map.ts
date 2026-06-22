import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

export function serializeWorkspaceFocusMap(
  map: Map<string, WorkspaceFocusInput>,
): Record<string, WorkspaceFocusInput> {
  return Object.fromEntries(map.entries());
}

export function deserializeWorkspaceFocusMap(
  record: Record<string, WorkspaceFocusInput>,
): Map<string, WorkspaceFocusInput> {
  return new Map(Object.entries(record));
}
