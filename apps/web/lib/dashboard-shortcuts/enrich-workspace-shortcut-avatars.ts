import type { WorkspaceAccountRow } from '~/home/_lib/server/workspace-scope';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';

import type { ResolvedShortcut } from './types';

const WORKSPACE_HREF_RE = /^\/app\/work\/([^/]+)/;

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
    const slug = shortcut.href.match(WORKSPACE_HREF_RE)?.[1]?.trim();

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
