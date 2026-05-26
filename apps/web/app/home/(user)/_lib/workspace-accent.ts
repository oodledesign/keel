import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { normalizeSpaceType } from '~/home/[account]/_lib/server/account-modules';

const SPACE_COLORS: Record<WorkspaceSpaceType, string> = {
  work: '#2563EB',
  property: '#2A9D8F',
  family: '#059669',
  community: '#D97706',
};

export function workspaceColorForSpaceType(
  spaceType: string | null | undefined,
): string {
  return SPACE_COLORS[normalizeSpaceType(spaceType)] ?? '#64748B';
}

/** Stable accent when only slug is known (sidebar list). */
export function workspaceAccentColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = ['#2563EB', '#2A9D8F', '#059669', '#D97706', '#7C3AED'];
  return hues[Math.abs(hash) % hues.length]!;
}
