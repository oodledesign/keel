import {
  SHOPPING_OFFLINE_DB_NAME,
  SHOPPING_OFFLINE_DB_VERSION,
  type ShoppingOfflineSnapshot,
  type ShoppingOutboxMutation,
} from '~/lib/meals/shopping-offline';

const SNAPSHOT_STORE = 'snapshots';
const OUTBOX_STORE = 'outbox';

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openShoppingOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      SHOPPING_OFFLINE_DB_NAME,
      SHOPPING_OFFLINE_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'scopeKey' });
      }

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        store.createIndex('scopeKey', 'scopeKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open shopping offline db'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openShoppingOfflineDb();

  try {
    const tx = db.transaction(storeName, mode);
    return await run(tx.objectStore(storeName));
  } finally {
    db.close();
  }
}

export async function loadShoppingSnapshot(
  scopeKey: string,
): Promise<ShoppingOfflineSnapshot | null> {
  if (!canUseIndexedDb()) return null;

  const row = await withStore(SNAPSHOT_STORE, 'readonly', (store) =>
    requestToPromise(store.get(scopeKey)),
  );

  return (row as ShoppingOfflineSnapshot | undefined) ?? null;
}

export async function saveShoppingSnapshot(
  snapshot: ShoppingOfflineSnapshot,
): Promise<void> {
  if (!canUseIndexedDb()) return;

  await withStore(SNAPSHOT_STORE, 'readwrite', (store) =>
    requestToPromise(store.put(snapshot)),
  );
}

export async function loadShoppingOutbox(
  scopeKey: string,
): Promise<ShoppingOutboxMutation[]> {
  if (!canUseIndexedDb()) return [];

  const rows = await withStore(OUTBOX_STORE, 'readonly', async (store) => {
    const index = store.index('scopeKey');
    return requestToPromise(index.getAll(scopeKey));
  });

  return (rows as ShoppingOutboxMutation[]).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

export async function enqueueShoppingOutbox(
  mutation: ShoppingOutboxMutation,
): Promise<void> {
  if (!canUseIndexedDb()) return;

  await withStore(OUTBOX_STORE, 'readwrite', (store) =>
    requestToPromise(store.put(mutation)),
  );
}

export async function removeShoppingOutbox(id: string): Promise<void> {
  if (!canUseIndexedDb()) return;

  await withStore(OUTBOX_STORE, 'readwrite', (store) =>
    requestToPromise(store.delete(id)),
  );
}
