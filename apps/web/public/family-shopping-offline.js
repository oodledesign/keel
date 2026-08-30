/* Keep in sync with apps/web/lib/meals/shopping-offline.ts */
const DB_NAME = 'ozer-family-shopping';
const DB_VERSION = 1;
const CATEGORY_ORDER = [
  'produce',
  'meat_fish',
  'dairy',
  'store_cupboard',
  'other',
];
const CATEGORY_LABELS = {
  produce: 'Produce',
  meat_fish: 'Meat/fish',
  dairy: 'Dairy',
  store_cupboard: 'Store cupboard',
  other: 'Other',
};

function applyTheme() {
  const stored = localStorage.getItem('ozer-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored === 'dark' || (stored !== 'light' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'scopeKey' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id' });
        store.createIndex('scopeKey', 'scopeKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadLatestSnapshot() {
  const db = await openDb();
  try {
    const snapshots = await requestValue(
      db.transaction('snapshots', 'readonly').objectStore('snapshots').getAll(),
    );
    return (
      (snapshots || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] ||
      null
    );
  } finally {
    db.close();
  }
}

async function loadOutbox(scopeKey) {
  const db = await openDb();
  try {
    const rows = await requestValue(
      db
        .transaction('outbox', 'readonly')
        .objectStore('outbox')
        .index('scopeKey')
        .getAll(scopeKey),
    );
    return (rows || []).sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

async function putOutbox(mutation) {
  const db = await openDb();
  try {
    await requestValue(
      db.transaction('outbox', 'readwrite').objectStore('outbox').put(mutation),
    );
  } finally {
    db.close();
  }
}

function applyOutbox(list, mutations) {
  return [...mutations]
    .filter((mutation) => !mutation.listId || mutation.listId === list.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .reduce((current, mutation) => {
      if (mutation.type === 'toggle') {
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === mutation.itemId
              ? { ...item, checked: mutation.checked }
              : item,
          ),
        };
      }

      if (current.items.some((item) => item.id === mutation.tempItemId)) {
        return current;
      }

      const nextOrder =
        current.items.reduce((max, item) => Math.max(max, item.sort_order), -1) +
        1;

      return {
        ...current,
        items: [
          ...current.items,
          {
            id: mutation.tempItemId,
            list_id: current.id,
            sort_order: nextOrder,
            name: mutation.text,
            amount: null,
            unit: null,
            category: 'other',
            display_text: mutation.text,
            is_unparsed: true,
            checked: false,
          },
        ],
      };
    }, list);
}

function weekRangeLabel(weekStart) {
  const [year, month, day] = (weekStart || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);
  const fmt = (date) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel() {
  if (!navigator.onLine) return 'Offline';
  return 'Saved on this device';
}

let snapshot = null;
let outbox = [];

function currentList() {
  if (!snapshot?.list) return null;
  return applyOutbox(snapshot.list, outbox);
}

function render() {
  const list = currentList();
  const meta = document.getElementById('meta');
  const root = document.getElementById('list');
  const addRow = document.getElementById('add-row');

  if (!list) {
    addRow.hidden = true;
    meta.innerHTML = `<span class="status">${statusLabel()}</span>`;
    root.innerHTML =
      '<p class="empty">No shopping list is saved on this device yet. Open Shopping while you have a signal, then you can use it offline.</p>';
    return;
  }

  const remaining = list.items.filter((item) => !item.checked).length;
  meta.innerHTML = `Week of ${escapeHtml(weekRangeLabel(list.week_start))} · ${remaining} to buy · ${list.items.length} items · <span class="status">${statusLabel()}</span>`;
  addRow.hidden = false;

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: list.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  root.innerHTML = groups
    .map((group) => {
      const items = group.items
        .map((item) => {
          const checked = item.checked ? 'checked' : '';
          const checkedClass = item.checked ? ' checked' : '';
          return `<li><label class="item${checkedClass}"><input type="checkbox" data-item-id="${escapeHtml(item.id)}" ${checked} /><span>${escapeHtml(item.display_text)}</span></label></li>`;
        })
        .join('');
      return `<section class="section"><h2>${CATEGORY_LABELS[group.category] || 'Other'}</h2><ul>${items}</ul></section>`;
    })
    .join('');
}

async function enqueue(mutation) {
  outbox = [...outbox, mutation];
  await putOutbox(mutation);
  render();
}

async function onToggle(itemId, checked) {
  const list = currentList();
  if (!list) return;
  await enqueue({
    id: uuid(),
    scopeKey: snapshot.scopeKey,
    createdAt: Date.now(),
    type: 'toggle',
    listId: list.id,
    itemId,
    checked,
  });
}

async function onAdd(text) {
  const list = currentList();
  const trimmed = text.trim();
  if (!list || !trimmed) return;
  await enqueue({
    id: uuid(),
    scopeKey: snapshot.scopeKey,
    createdAt: Date.now(),
    type: 'add',
    listId: list.id,
    weekStart: list.week_start,
    text: trimmed,
    tempItemId: uuid(),
  });
}

async function boot() {
  applyTheme();
  snapshot = await loadLatestSnapshot();
  outbox = snapshot ? await loadOutbox(snapshot.scopeKey) : [];
  render();

  document.getElementById('list').addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
      return;
    }
    void onToggle(target.getAttribute('data-item-id'), target.checked);
  });

  const input = document.getElementById('add-input');
  const addButton = document.getElementById('add-button');
  const submit = () => {
    void onAdd(input.value).then(() => {
      input.value = '';
    });
  };
  addButton.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });

  window.addEventListener('online', () => {
    window.location.reload();
  });
  window.addEventListener('offline', render);
}

void boot();
