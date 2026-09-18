import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyWorkspaceOrder,
  moveWorkspaceInOrder,
  parseWorkspaceSwitcherPrefs,
  readWorkspaceSwitcherPrefs,
  subscribeWorkspaceSwitcherPrefs,
  workspaceSwitcherPrefsKey,
  writeWorkspaceSwitcherPrefs,
} from './workspace-switcher-prefs';

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

describe('parseWorkspaceSwitcherPrefs', () => {
  it('defaults to no custom order and hidden search', () => {
    expect(parseWorkspaceSwitcherPrefs(null)).toEqual({
      order: [],
      showSearch: false,
    });
    expect(parseWorkspaceSwitcherPrefs('')).toEqual({
      order: [],
      showSearch: false,
    });
  });

  it('reads a valid payload and de-duplicates order ids', () => {
    expect(
      parseWorkspaceSwitcherPrefs(
        JSON.stringify({
          order: ['a', 'b', 'a', ''],
          showSearch: true,
        }),
      ),
    ).toEqual({
      order: ['a', 'b'],
      showSearch: true,
    });
  });

  it('ignores corrupt payloads', () => {
    expect(parseWorkspaceSwitcherPrefs('{')).toEqual({
      order: [],
      showSearch: false,
    });
    expect(parseWorkspaceSwitcherPrefs(JSON.stringify({ order: 3 }))).toEqual({
      order: [],
      showSearch: false,
    });
  });
});

describe('workspace switcher preference storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scopes the key by user id', () => {
    expect(workspaceSwitcherPrefsKey('user-1')).toBe(
      'ozer-workspace-switcher-prefs:user-1',
    );
  });

  it('reads and writes prefs per user', () => {
    writeWorkspaceSwitcherPrefs('user-1', {
      order: ['ws-a', 'ws-b'],
      showSearch: true,
    });
    writeWorkspaceSwitcherPrefs('user-2', {
      order: ['ws-c'],
      showSearch: false,
    });

    expect(readWorkspaceSwitcherPrefs('user-1')).toEqual({
      order: ['ws-a', 'ws-b'],
      showSearch: true,
    });
    expect(readWorkspaceSwitcherPrefs('user-2')).toEqual({
      order: ['ws-c'],
      showSearch: false,
    });
    expect(readWorkspaceSwitcherPrefs('missing')).toEqual({
      order: [],
      showSearch: false,
    });
  });

  it('notifies subscribers after a write', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWorkspaceSwitcherPrefs(listener);

    writeWorkspaceSwitcherPrefs('user-1', {
      order: ['ws-a'],
      showSearch: true,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('applyWorkspaceOrder', () => {
  it('keeps incoming order when no preference is stored', () => {
    const accounts = [{ id: 'a' }, { id: 'b' }];
    expect(applyWorkspaceOrder(accounts, [])).toEqual(accounts);
  });

  it('applies saved order and appends new workspaces', () => {
    const accounts = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    expect(applyWorkspaceOrder(accounts, ['b', 'a'])).toEqual([
      { id: 'b' },
      { id: 'a' },
      { id: 'c' },
    ]);
  });
});

describe('moveWorkspaceInOrder', () => {
  it('moves an id up or down and no-ops at the edges', () => {
    expect(moveWorkspaceInOrder(['a', 'b', 'c'], 'b', -1)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(moveWorkspaceInOrder(['a', 'b', 'c'], 'b', 1)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(moveWorkspaceInOrder(['a', 'b', 'c'], 'a', -1)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(moveWorkspaceInOrder(['a', 'b', 'c'], 'c', 1)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
