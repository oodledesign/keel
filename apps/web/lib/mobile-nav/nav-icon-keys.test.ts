import { describe, expect, it } from 'vitest';

import { normalizeAppHref } from '~/lib/dashboard-shortcuts/personal-home-url';
import { resolveNavIconKey } from '~/lib/mobile-nav/nav-icon-keys';

describe('normalizeAppHref legacy workspace paths', () => {
  it('rewrites /app/work/{slug}/… to /app/{slug}/…', () => {
    expect(normalizeAppHref('/app/work/oodle/tasks')).toBe('/app/oodle/tasks');
    expect(normalizeAppHref('/app/work/oodle/planner/day')).toBe(
      '/app/oodle/planner/day',
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
