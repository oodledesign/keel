import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { normalizeSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { ozerColors, ozerWorkspaceSpaceColors } from '~/lib/ozer/design-tokens';

const SPACE_COLORS: Record<WorkspaceSpaceType, string> = {
  work: ozerWorkspaceSpaceColors.work,
  property: ozerWorkspaceSpaceColors.property,
  family: ozerWorkspaceSpaceColors.family,
  community: ozerWorkspaceSpaceColors.community,
};

export function workspaceColorForSpaceType(
  spaceType: string | null | undefined,
): string {
  return SPACE_COLORS[normalizeSpaceType(spaceType)] ?? ozerColors.info;
}

/** Stable accent when only slug is known (sidebar list). */
export function workspaceAccentColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [
    ozerWorkspaceSpaceColors.work,
    ozerWorkspaceSpaceColors.property,
    ozerWorkspaceSpaceColors.family,
    ozerWorkspaceSpaceColors.community,
    '#7C3AED',
  ];
  return hues[Math.abs(hash) % hues.length]!;
}
