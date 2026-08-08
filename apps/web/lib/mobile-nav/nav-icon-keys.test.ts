import { describe, expect, it } from 'vitest';

import {
  normalizeAppHref,
  rewriteHrefToWorkspaceSlug,
} from '~/lib/dashboard-shortcuts/personal-home-url';
import { resolveNavIconKey } from '~/lib/mobile-nav/nav-icon-keys';

describe('normalizeAppHref legacy workspace paths', () => {
  it('rewrites /app/work/{slug}/… to /app/{slug}/…', () => {
    expect(normalizeAppHref('/app/work/oodle/tasks')).toBe('/app/oodle/tasks');
    expect(normalizeAppHref('/app/work/oodle/planner/day')).toBe(
      '/app/oodle/planner/day',
    );
  });
});

describe('rewriteHrefToWorkspaceSlug', () => {
  it('maps stale/legacy workspace slugs onto the current account', () => {
    expect(
      rewriteHrefToWorkspaceSlug('/app/work/oodle/tasks', 'oodle-design'),
    ).toBe('/app/oodle-design/tasks');
    expect(
      rewriteHrefToWorkspaceSlug('/app/oodle/pipeline', 'oodle-design'),
    ).toBe('/app/oodle-design/pipeline');
    expect(
      rewriteHrefToWorkspaceSlug(
        '/app/oodle/planner/day?tab=focus',
        'oodle-design',
      ),
    ).toBe('/app/oodle-design/planner/day?tab=focus');
  });

  it('leaves matching and personal routes alone', () => {
    expect(rewriteHrefToWorkspaceSlug('/app/oodle', 'oodle-design')).toBe(
      '/app/oodle-design',
    );
    expect(
      rewriteHrefToWorkspaceSlug('/app/oodle-design/tasks', 'oodle-design'),
    ).toBe('/app/oodle-design/tasks');
    expect(rewriteHrefToWorkspaceSlug('/app/tasks', 'oodle-design')).toBe(
      '/app/tasks',
    );
    expect(rewriteHrefToWorkspaceSlug('/app/settings', 'oodle-design')).toBe(
      '/app/settings',
    );
  });
});

describe('resolveNavIconKey', () => {
  it('resolves canonical workspace module paths', () => {
    expect(resolveNavIconKey('/app/oodle/tasks')).toBe('tasks');
    expect(resolveNavIconKey('/app/oodle/notes')).toBe('notes');
    expect(resolveNavIconKey('/app/oodle/planner/day')).toBe('today');
    expect(resolveNavIconKey('/app/oodle/planner/plan')).toBe('planner');
  });

  it('resolves legacy /app/work/{slug}/… paths', () => {
    expect(resolveNavIconKey('/app/work/oodle/tasks')).toBe('tasks');
    expect(resolveNavIconKey('/app/work/oodle/notes')).toBe('notes');
    expect(resolveNavIconKey('/app/work/oodle/planner/day')).toBe('today');
  });
});
