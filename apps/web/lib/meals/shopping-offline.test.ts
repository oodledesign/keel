import { describe, expect, it } from 'vitest';

import {
  type ShoppingOfflineList,
  type ShoppingOutboxAdd,
  type ShoppingOutboxMutation,
  type ShoppingOutboxToggle,
  applyShoppingOutbox,
  applyShoppingOutboxMutation,
  createOptimisticAddItem,
  isFamilyShoppingPath,
  isNetworkLikeError,
  remapOutboxItemId,
  shoppingScopeKey,
  shoppingSyncStatus,
} from '~/lib/meals/shopping-offline';

function list(items: ShoppingOfflineList['items']): ShoppingOfflineList {
  return {
    id: 'list-1',
    user_id: 'user-1',
    account_id: null,
    week_start: '2026-08-24',
    skipped_meals: [],
    generated_at: '2026-08-24T08:00:00.000Z',
    created_at: '2026-08-24T08:00:00.000Z',
    updated_at: '2026-08-24T08:00:00.000Z',
    items,
  };
}

function item(
  id: string,
  displayText: string,
  checked = false,
): ShoppingOfflineList['items'][number] {
  return {
    id,
    list_id: 'list-1',
    sort_order: 0,
    name: displayText,
    amount: null,
    unit: null,
    category: 'other',
    display_text: displayText,
    is_unparsed: false,
    checked,
    created_at: '2026-08-24T08:00:00.000Z',
    updated_at: '2026-08-24T08:00:00.000Z',
  };
}

function toggle(
  partial: Partial<ShoppingOutboxToggle> &
    Pick<ShoppingOutboxToggle, 'itemId' | 'checked' | 'createdAt'>,
): ShoppingOutboxToggle {
  return {
    id: `mut-toggle-${partial.createdAt}`,
    scopeKey: 'personal',
    type: 'toggle',
    listId: 'list-1',
    ...partial,
  };
}

function add(
  partial: Partial<ShoppingOutboxAdd> &
    Pick<ShoppingOutboxAdd, 'text' | 'tempItemId' | 'createdAt'>,
): ShoppingOutboxAdd {
  return {
    id: `mut-add-${partial.createdAt}`,
    scopeKey: 'personal',
    type: 'add',
    listId: 'list-1',
    weekStart: '2026-08-24',
    ...partial,
  };
}

describe('applyShoppingOutbox', () => {
  it('applies a toggle to an existing item (last write wins)', () => {
    const current = list([item('item-1', '2 onions')]);
    const mutations: ShoppingOutboxMutation[] = [
      toggle({ itemId: 'item-1', checked: true, createdAt: 1 }),
      toggle({ itemId: 'item-1', checked: false, createdAt: 2 }),
      toggle({ itemId: 'item-1', checked: true, createdAt: 3 }),
    ];

    const next = applyShoppingOutbox(current, mutations);
    expect(next.items[0]?.checked).toBe(true);
  });

  it('applies add then toggle on the new item in order', () => {
    const current = list([item('item-1', '2 onions')]);
    const mutations: ShoppingOutboxMutation[] = [
      add({
        text: '1 pint milk',
        tempItemId: 'temp-milk',
        createdAt: 10,
      }),
      toggle({ itemId: 'temp-milk', checked: true, createdAt: 11 }),
    ];

    const next = applyShoppingOutbox(current, mutations);

    expect(next.items).toHaveLength(2);
    const milk = next.items.find((row) => row.id === 'temp-milk');
    expect(milk).toMatchObject({
      id: 'temp-milk',
      checked: true,
    });
    expect(milk?.display_text.toLowerCase()).toContain('milk');
    expect(next.items[0]).toMatchObject({ id: 'item-1', checked: false });
  });

  it('keeps existing toggles and later adds in createdAt order', () => {
    const current = list([
      item('item-1', '2 onions'),
      item('item-2', '500g pasta'),
    ]);

    const mutations: ShoppingOutboxMutation[] = [
      toggle({ itemId: 'item-2', checked: true, createdAt: 5 }),
      add({
        text: '2 peppers',
        tempItemId: 'temp-peppers',
        createdAt: 6,
      }),
      toggle({ itemId: 'temp-peppers', checked: true, createdAt: 7 }),
      toggle({ itemId: 'item-1', checked: true, createdAt: 8 }),
    ];

    const next = applyShoppingOutbox(current, mutations);

    expect(next.items.map((row) => [row.id, row.checked])).toEqual([
      ['item-1', true],
      ['item-2', true],
      ['temp-peppers', true],
    ]);
  });

  it('does not apply mutations for another list', () => {
    const current = list([item('item-1', '2 onions')]);
    const next = applyShoppingOutbox(current, [
      toggle({
        itemId: 'item-1',
        checked: true,
        createdAt: 1,
        listId: 'list-other',
      }),
    ]);

    expect(next.items[0]?.checked).toBe(false);
  });

  it('is idempotent when the same add is applied twice', () => {
    const current = list([item('item-1', '2 onions')]);
    const mutation = add({
      text: 'bread',
      tempItemId: 'temp-bread',
      createdAt: 1,
    });

    const once = applyShoppingOutboxMutation(current, mutation);
    const twice = applyShoppingOutboxMutation(once, mutation);

    expect(twice.items.filter((row) => row.id === 'temp-bread')).toHaveLength(
      1,
    );
  });
});

describe('createOptimisticAddItem', () => {
  it('parses a quantity line into a shopping row', () => {
    const row = createOptimisticAddItem(
      list([]),
      add({ text: '2 onions', tempItemId: 'temp-1', createdAt: 1 }),
    );

    expect(row).toMatchObject({
      id: 'temp-1',
      display_text: '2 onions',
      category: 'produce',
      checked: false,
    });
  });
});

describe('remapOutboxItemId', () => {
  it('rewrites later toggles from a temp id to the server id', () => {
    const remapped = remapOutboxItemId(
      [
        add({
          text: 'milk',
          tempItemId: 'temp-milk',
          createdAt: 1,
        }),
        toggle({ itemId: 'temp-milk', checked: true, createdAt: 2 }),
      ],
      'temp-milk',
      'server-milk',
    );

    expect(remapped[0]).toMatchObject({
      type: 'add',
      tempItemId: 'server-milk',
    });
    expect(remapped[1]).toMatchObject({
      type: 'toggle',
      itemId: 'server-milk',
    });
  });
});

describe('shopping helpers', () => {
  it('builds a scope key for personal and workspace lists', () => {
    expect(shoppingScopeKey()).toBe('personal');
    expect(shoppingScopeKey('acme')).toBe('workspace:acme');
  });

  it('recognises family shopping paths only', () => {
    expect(isFamilyShoppingPath('/app/life/family/shopping')).toBe(true);
    expect(isFamilyShoppingPath('/app/acme/shopping?week=2026-08-24')).toBe(
      true,
    );
    expect(isFamilyShoppingPath('/app/acme/shopping')).toBe(true);
    expect(isFamilyShoppingPath('/home/acme/shopping/')).toBe(true);
    expect(isFamilyShoppingPath('/app/planner')).toBe(false);
    expect(isFamilyShoppingPath('/app/life/family')).toBe(false);
    expect(isFamilyShoppingPath('/app/acme/meal-plan')).toBe(false);
  });

  it('prefers Syncing, then Offline, then saved-on-device', () => {
    expect(
      shoppingSyncStatus({ online: false, syncing: true, pendingCount: 2 }),
    ).toBe('syncing');
    expect(
      shoppingSyncStatus({ online: false, syncing: false, pendingCount: 2 }),
    ).toBe('offline');
    expect(
      shoppingSyncStatus({ online: true, syncing: false, pendingCount: 1 }),
    ).toBe('saved');
    expect(
      shoppingSyncStatus({ online: true, syncing: false, pendingCount: 0 }),
    ).toBe('idle');
  });

  it('treats fetch failures as network-like errors', () => {
    expect(isNetworkLikeError(new TypeError('Failed to fetch'))).toBe(true);
    expect(
      isNetworkLikeError('The Internet connection appears to be offline.'),
    ).toBe(true);
    expect(isNetworkLikeError(new Error('Item not found'))).toBe(false);
  });
});
