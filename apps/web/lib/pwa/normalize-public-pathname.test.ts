import { describe, expect, it } from 'vitest';

import {
  isWorkspaceDashboardHome,
  normalizePublicPathname,
} from './normalize-public-pathname';

describe('normalizePublicPathname', () => {
  it('maps internal home routes to public app routes', () => {
    expect(normalizePublicPathname('/home/oodle')).toBe('/app/oodle');
    expect(normalizePublicPathname('/home/oodle/tasks')).toBe(
      '/app/oodle/tasks',
    );
    expect(normalizePublicPathname('/home')).toBe('/app');
  });

  it('leaves public app routes unchanged', () => {
    expect(normalizePublicPathname('/app/oodle')).toBe('/app/oodle');
    expect(normalizePublicPathname('/app/oodle/')).toBe('/app/oodle/');
  });
});

describe('isWorkspaceDashboardHome', () => {
  it('matches workspace home on public and internal paths', () => {
    expect(isWorkspaceDashboardHome('/app/oodle')).toBe(true);
    expect(isWorkspaceDashboardHome('/app/oodle/')).toBe(true);
    expect(isWorkspaceDashboardHome('/home/oodle')).toBe(true);
  });

  it('does not match nested workspace routes', () => {
    expect(isWorkspaceDashboardHome('/app/oodle/tasks')).toBe(false);
    expect(isWorkspaceDashboardHome('/home/oodle/tasks')).toBe(false);
    expect(isWorkspaceDashboardHome('/app/settings')).toBe(false);
  });
});
