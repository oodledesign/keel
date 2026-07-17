import type { WorkspaceBlockPack } from './types';
import { ybbPack } from './workspaces/ybb';

/**
 * Static allowlist of workspace packs, keyed by `accounts.slug`.
 *
 * To register a new workspace pack:
 * 1. Create `src/workspaces/{accountSlug}/` (copy `_template`).
 * 2. Import the pack here and add it to the map.
 * 3. Redeploy `ozer` (editor) and `ozer-sites` (public renderer).
 */
const WORKSPACE_PACKS: Record<string, WorkspaceBlockPack> = {
  [ybbPack.slug]: ybbPack,
};

export function getWorkspacePack(
  accountSlug: string | null | undefined,
): WorkspaceBlockPack | null {
  if (!accountSlug) return null;
  return WORKSPACE_PACKS[accountSlug] ?? null;
}

export function listWorkspacePackSlugs(): string[] {
  return Object.keys(WORKSPACE_PACKS);
}
