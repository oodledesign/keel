'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  type ShoppingOfflineList,
  type ShoppingOutboxMutation,
  type ShoppingSyncStatus,
  applyShoppingOutbox,
  isNetworkLikeError,
  shoppingScopeKey,
  shoppingSyncStatus,
} from '~/lib/meals/shopping-offline';
import {
  enqueueShoppingOutbox,
  loadShoppingOutbox,
  loadShoppingSnapshot,
  removeShoppingOutbox,
  saveShoppingSnapshot,
} from '~/lib/meals/shopping-offline-db';

import type { ShoppingListWithItems } from './schema/family-shopping.schema';
import {
  addShoppingItemAction,
  toggleShoppingItemAction,
} from './shopping-actions';

type FlushResult = 'ok' | 'network' | 'fail';

export function useShoppingListOffline(input: {
  list: ShoppingListWithItems | null;
  weekStart: string;
  accountSlug?: string;
  mealPlanHref: string;
}) {
  const router = useRouter();
  const [baseList, setBaseList] = useState<ShoppingOfflineList | null>(
    input.list,
  );
  const [outbox, setOutbox] = useState<ShoppingOutboxMutation[]>([]);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);

  const outboxRef = useRef(outbox);
  const flushingRef = useRef(false);
  const writingIdsRef = useRef(new Set<string>());
  const inputRef = useRef(input);

  outboxRef.current = outbox;
  inputRef.current = input;

  const displayList = useMemo(() => {
    if (!baseList) return null;
    return applyShoppingOutbox(baseList, outbox);
  }, [baseList, outbox]);

  const status: ShoppingSyncStatus = shoppingSyncStatus({
    online,
    syncing,
    pendingCount: outbox.length,
  });

  const persistSnapshot = useCallback(
    async (list: ShoppingOfflineList | null) => {
      const current = inputRef.current;
      await saveShoppingSnapshot({
        scopeKey: shoppingScopeKey(current.accountSlug),
        list,
        weekStart: current.weekStart,
        accountSlug: current.accountSlug,
        mealPlanHref: current.mealPlanHref,
        updatedAt: Date.now(),
      });
    },
    [],
  );

  const applyServerMutation = useCallback(
    async (mutation: ShoppingOutboxMutation): Promise<FlushResult> => {
      const accountSlug = inputRef.current.accountSlug;

      try {
        if (mutation.type === 'toggle') {
          const result = await toggleShoppingItemAction({
            itemId: mutation.itemId,
            checked: mutation.checked,
            accountSlug,
          });

          if (result.success) return 'ok';
          return isNetworkLikeError(result.error) ? 'network' : 'fail';
        }

        const result = await addShoppingItemAction({
          listId: mutation.listId,
          weekStart: mutation.weekStart,
          text: mutation.text,
          clientItemId: mutation.tempItemId,
          accountSlug,
        });

        if (result.success) return 'ok';
        return isNetworkLikeError(result.error) ? 'network' : 'fail';
      } catch (error) {
        return isNetworkLikeError(error) ? 'network' : 'fail';
      }
    },
    [],
  );

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (outboxRef.current.length === 0) return;

    flushingRef.current = true;
    setSyncing(true);
    let synced = 0;

    try {
      while (outboxRef.current.length > 0) {
        const next = outboxRef.current[0];
        if (!next) break;
        // Do not flush a mutation until its IndexedDB write has finished,
        // otherwise a successful sync can delete nothing and the row is
        // written afterwards (duplicate add / extra toggle on reload).
        if (writingIdsRef.current.has(next.id)) break;

        const result = await applyServerMutation(next);

        if (result === 'network') {
          break;
        }

        await removeShoppingOutbox(next.id);
        setOutbox((current) => {
          const remaining = current.filter((item) => item.id !== next.id);
          outboxRef.current = remaining;
          return remaining;
        });
        synced += 1;

        if (result === 'fail') {
          continue;
        }
      }

      if (synced > 0 && outboxRef.current.length === 0) {
        // revalidatePath in the actions is not enough after an offline queue
        // drain — the client still holds the optimistic list until refresh.
        router.refresh();
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [applyServerMutation, router]);

  useEffect(() => {
    let cancelled = false;
    const scopeKey = shoppingScopeKey(input.accountSlug);

    void (async () => {
      const queued = await loadShoppingOutbox(scopeKey);
      if (cancelled) return;
      outboxRef.current = queued;
      setOutbox(queued);

      const serverList = input.list;

      if (serverList) {
        setBaseList(serverList);
        await persistSnapshot(serverList);
      } else {
        const snapshot = await loadShoppingSnapshot(scopeKey);
        if (cancelled) return;
        if (snapshot?.list && !navigator.onLine) {
          setBaseList(snapshot.list);
        } else {
          setBaseList(null);
        }
      }

      void flush();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    flush,
    input.accountSlug,
    input.list,
    input.mealPlanHref,
    input.weekStart,
    persistSnapshot,
  ]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void flush();
      }
    };

    updateOnline();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flush]);

  const enqueue = useCallback(
    async (mutation: ShoppingOutboxMutation) => {
      writingIdsRef.current.add(mutation.id);
      setOutbox((current) => {
        const next = [...current, mutation];
        outboxRef.current = next;
        return next;
      });
      try {
        await enqueueShoppingOutbox(mutation);
      } catch {
        // Keep the in-memory queue even if IDB is unavailable (private mode).
      } finally {
        writingIdsRef.current.delete(mutation.id);
      }
      void flush();
    },
    [flush],
  );

  const toggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
      const currentList = displayList;
      if (!currentList) return;

      await enqueue({
        id: crypto.randomUUID(),
        scopeKey: shoppingScopeKey(inputRef.current.accountSlug),
        createdAt: Date.now(),
        type: 'toggle',
        listId: currentList.id,
        itemId,
        checked,
      });
    },
    [displayList, enqueue],
  );

  const addItem = useCallback(
    async (text: string) => {
      const currentList = displayList;
      if (!currentList) return false;

      const trimmed = text.trim();
      if (!trimmed) return false;

      await enqueue({
        id: crypto.randomUUID(),
        scopeKey: shoppingScopeKey(inputRef.current.accountSlug),
        createdAt: Date.now(),
        type: 'add',
        listId: currentList.id,
        weekStart: currentList.week_start,
        text: trimmed,
        tempItemId: crypto.randomUUID(),
      });

      return true;
    },
    [displayList, enqueue],
  );

  return {
    list: displayList as ShoppingListWithItems | null,
    status,
    toggleItem,
    addItem,
  };
}
