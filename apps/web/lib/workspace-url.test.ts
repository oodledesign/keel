import { describe, expect, it } from 'vitest';

import {
  isReservedWorkspaceUrlSegment,
  workspaceAccountUrlSegmentPattern,
} from '@kit/shared/workspace-url';

function matchesWorkspaceSlug(slug: string): boolean {
  const pattern = new RegExp(`^${workspaceAccountUrlSegmentPattern()}$`);
  return pattern.test(slug);
}

describe('workspaceAccountUrlSegmentPattern', () => {
  it('allows slugs that only share a prefix with reserved segments', () => {
    expect(matchesWorkspaceSlug('homegroup')).toBe(true);
    expect(matchesWorkspaceSlug('workshop')).toBe(true);
    expect(matchesWorkspaceSlug('community-center')).toBe(true);
    expect(matchesWorkspaceSlug('family-matters')).toBe(true);
  });

  it('blocks exact reserved segments', () => {
    for (const segment of ['home', 'settings', 'community', 'work']) {
      expect(isReservedWorkspaceUrlSegment(segment)).toBe(true);
      expect(matchesWorkspaceSlug(segment)).toBe(false);
    }
  });
});
