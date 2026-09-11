import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseProjectsPageView,
  projectsPageViewStorageKey,
  readProjectsPageView,
  writeProjectsPageView,
} from './projects-page-view';

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    clear() {
      store.clear();
    },
  };
}

describe('parseProjectsPageView', () => {
  it('accepts persisted page views', () => {
    expect(parseProjectsPageView('table')).toBe('table');
    expect(parseProjectsPageView('timeline')).toBe('timeline');
    expect(parseProjectsPageView('kanban')).toBe('kanban');
  });

  it('rejects unknown or empty values', () => {
    expect(parseProjectsPageView('board')).toBeNull();
    expect(parseProjectsPageView('schedule')).toBeNull();
    expect(parseProjectsPageView('')).toBeNull();
    expect(parseProjectsPageView(null)).toBeNull();
  });
});

describe('projects page view storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scopes the key by workspace slug', () => {
    expect(projectsPageViewStorageKey('acme')).toBe('ozer-projects-view:acme');
    expect(projectsPageViewStorageKey('personal')).toBe(
      'ozer-projects-view:personal',
    );
  });

  it('reads and writes the last view per slug', () => {
    writeProjectsPageView('acme', 'kanban');
    writeProjectsPageView('other', 'table');

    expect(readProjectsPageView('acme')).toBe('kanban');
    expect(readProjectsPageView('other')).toBe('table');
    expect(readProjectsPageView('missing')).toBeNull();
  });

  it('ignores corrupt stored values', () => {
    window.localStorage.setItem('ozer-projects-view:acme', 'board');
    expect(readProjectsPageView('acme')).toBeNull();
  });
});
