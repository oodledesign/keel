import type { WorkspaceAccountRow } from '~/home/_lib/server/workspace-scope';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';

import type { ResolvedShortcut } from './types';

const PERSONAL_APP_SEGMENTS = new Set([
  'home',
  'tasks',
  'pipeline',
  'email',
  'planner',
  'people',
  'settings',
]);

function workspaceSlugFromHref(href: string): string | null {
  const match = href.match(/^\/app\/([^/?#]+)(?:\/|$)/);
  if (!match) return null;
  const segment = match[1]!.trim();
  if (!segment || PERSONAL_APP_SEGMENTS.has(segment)) return null;
  return segment;
}

function stripWorkspacePrefix(label: string, workspaceName: string): string {
  const needle = `${workspaceName} — `;

  if (label.startsWith(needle)) {
    return label.slice(needle.length);
  }

  return label;
}

export function enrichPersonalShortcutsWithWorkspaceAvatars(
  shortcuts: ResolvedShortcut[],
  workspaces: WorkspaceAccountRow[],
): ResolvedShortcut[] {
  const bySlug = new Map(
    workspaces
      .filter((workspace) => workspace.slug?.trim())
      .map((workspace) => [workspace.slug!.trim(), workspace]),
  );

  return shortcuts.map((shortcut) => {
    const slug = workspaceSlugFromHref(shortcut.href);

    if (!slug) {
      return shortcut;
    }

    const workspace = bySlug.get(slug);

    if (!workspace) {
      return shortcut;
    }

    const workspaceName = workspace.name?.trim() || slug;

    return {
      ...shortcut,
      label: stripWorkspacePrefix(shortcut.label, workspaceName),
      avatarUrl: workspace.picture_url ?? null,
      avatarColor: workspaceColorForSpaceType(workspace.space_type),
      avatarFallback: (workspaceName[0] ?? '?').toUpperCase(),
    };
  });
}
