import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_MOBILE_SCROLL_FILL_CLASS,
  WORKSPACE_MOBILE_SCROLL_PAGE_CLASS,
} from './workspace-mobile-scroll-area';

describe('workspace mobile scroll fill', () => {
  it('gives fill-height pages a definite flex height so boards can scroll', () => {
    expect(WORKSPACE_MOBILE_SCROLL_FILL_CLASS).toContain('h-full');
    expect(WORKSPACE_MOBILE_SCROLL_FILL_CLASS).toContain('min-h-full');
    expect(WORKSPACE_MOBILE_SCROLL_FILL_CLASS).toContain('flex');
    expect(WORKSPACE_MOBILE_SCROLL_FILL_CLASS).toContain('flex-col');
    expect(WORKSPACE_MOBILE_SCROLL_PAGE_CLASS).toContain('flex-1');
    expect(WORKSPACE_MOBILE_SCROLL_PAGE_CLASS).toContain('min-h-0');
    expect(WORKSPACE_MOBILE_SCROLL_PAGE_CLASS).toContain('flex-col');
  });
});
