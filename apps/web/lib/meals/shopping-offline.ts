import {
  type ShoppingCategory,
  parseAndMergeIngredientLines,
} from '~/lib/meals/shopping-list-merge';

export const SHOPPING_OFFLINE_DB_NAME = 'ozer-family-shopping';
export const SHOPPING_OFFLINE_DB_VERSION = 1;

export type ShoppingOfflineItem = {
  id: string;
  list_id: string;
  sort_order: number;
  name: string;
  amount: number | null;
  unit: string | null;
  category: ShoppingCategory;
  display_text: string;
  is_unparsed: boolean;
  checked: boolean;
  created_at: string;
  updated_at: string;
};

export type ShoppingOfflineList = {
  id: string;
  user_id: string;
  account_id: string | null;
  week_start: string;
  skipped_meals: string[];
  generated_at: string;
  created_at: string;
  updated_at: string;
  items: ShoppingOfflineItem[];
};

export type ShoppingOutboxToggle = {
  id: string;
  scopeKey: string;
  createdAt: number;
  type: 'toggle';
  listId: string;
  itemId: string;
  checked: boolean;
};

export type ShoppingOutboxAdd = {
  id: string;
  scopeKey: string;
  createdAt: number;
  type: 'add';
  listId: string;
  weekStart: string;
  text: string;
  tempItemId: string;
};

export type ShoppingOutboxMutation = ShoppingOutboxToggle | ShoppingOutboxAdd;

export type ShoppingOfflineSnapshot = {
  scopeKey: string;
  list: ShoppingOfflineList | null;
  weekStart: string;
  accountSlug?: string;
  mealPlanHref: string;
  updatedAt: number;
};

export type ShoppingSyncStatus = 'idle' | 'offline' | 'saved' | 'syncing';

export function shoppingScopeKey(accountSlug?: string): string {
  return accountSlug ? `workspace:${accountSlug}` : 'personal';
}

export function isFamilyShoppingPath(pathname: string): boolean {
  const withoutSearch = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  const path = withoutSearch.replace(/\/+$/, '') || '/';

  if (
    path === '/app/life/family/shopping' ||
    path === '/home/life/family/shopping'
  ) {
    return true;
  }

  return /^\/(app|home)\/[^/]+\/shopping$/.test(path);
}

export function shoppingSyncStatus(input: {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
}): ShoppingSyncStatus {
  if (input.syncing) return 'syncing';
  if (!input.online) return 'offline';
  if (input.pendingCount > 0) return 'saved';
  return 'idle';
}

export function shoppingSyncStatusLabel(status: ShoppingSyncStatus): string {
  switch (status) {
    case 'offline':
      return 'Offline';
    case 'saved':
      return 'Saved on this device';
    case 'syncing':
      return 'Syncing…';
    default:
      return '';
  }
}

export function isNetworkLikeError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  const message = errorMessage(error);

  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|the internet connection appears to be offline|the network connection was lost|offline/i.test(
    message,
  );
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
}

export function createOptimisticAddItem(
  list: ShoppingOfflineList,
  mutation: ShoppingOutboxAdd,
): ShoppingOfflineItem {
  const parsed = parseAndMergeIngredientLines([mutation.text])[0];
  const now = new Date(mutation.createdAt).toISOString();
  const nextOrder =
    list.items.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;

  return {
    id: mutation.tempItemId,
    list_id: list.id,
    sort_order: nextOrder,
    name: parsed?.name ?? mutation.text,
    amount: parsed?.amount ?? null,
    unit: parsed?.unit ?? null,
    category: parsed?.category ?? 'other',
    display_text: parsed?.display_text ?? mutation.text,
    is_unparsed: parsed?.is_unparsed ?? true,
    checked: false,
    created_at: now,
    updated_at: now,
  };
}

export function applyShoppingOutboxMutation(
  list: ShoppingOfflineList,
  mutation: ShoppingOutboxMutation,
): ShoppingOfflineList {
  if (mutation.listId && mutation.listId !== list.id) {
    return list;
  }

  if (mutation.type === 'toggle') {
    return {
      ...list,
      items: list.items.map((item) =>
        item.id === mutation.itemId
          ? {
              ...item,
              checked: mutation.checked,
              updated_at: new Date(mutation.createdAt).toISOString(),
            }
          : item,
      ),
    };
  }

  if (list.items.some((item) => item.id === mutation.tempItemId)) {
    return list;
  }

  return {
    ...list,
    items: [...list.items, createOptimisticAddItem(list, mutation)],
  };
}

export function applyShoppingOutbox(
  list: ShoppingOfflineList,
  mutations: ShoppingOutboxMutation[],
): ShoppingOfflineList {
  return [...mutations]
    .sort((a, b) => a.createdAt - b.createdAt)
    .reduce(applyShoppingOutboxMutation, list);
}

export function remapOutboxItemId(
  mutations: ShoppingOutboxMutation[],
  fromId: string,
  toId: string,
): ShoppingOutboxMutation[] {
  if (fromId === toId) return mutations;

  return mutations.map((mutation) => {
    if (mutation.type === 'toggle' && mutation.itemId === fromId) {
      return { ...mutation, itemId: toId };
    }

    if (mutation.type === 'add' && mutation.tempItemId === fromId) {
      return { ...mutation, tempItemId: toId };
    }

    return mutation;
  });
}
