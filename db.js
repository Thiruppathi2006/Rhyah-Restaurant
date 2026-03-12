const DB_NAME = 'rhyah_pos_v1';
const DB_VERSION = 1;

const STORES = {
  menuItems: 'menuItems',
  orders: 'orders',
  orderItems: 'orderItems',
  settings: 'settings',
};

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export function openDb() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = () => {
    const db = req.result;

    if (!db.objectStoreNames.contains(STORES.menuItems)) {
      db.createObjectStore(STORES.menuItems, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORES.orders)) {
      db.createObjectStore(STORES.orders, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORES.orderItems)) {
      const s = db.createObjectStore(STORES.orderItems, { keyPath: 'id' });
      s.createIndex('by_orderId', 'orderId', { unique: false });
      s.createIndex('by_menuItemId', 'menuItemId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.settings)) {
      db.createObjectStore(STORES.settings, { keyPath: 'key' });
    }
  };

  return reqToPromise(req);
}

export async function withTx(storeNames, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(storeNames, mode);
  const stores = storeNames.reduce((acc, n) => {
    acc[n] = tx.objectStore(n);
    return acc;
  }, {});

  const out = await fn(stores, tx);
  await txDone(tx);
  db.close();
  return out;
}

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  // RFC4122-ish v4
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getSetting(key) {
  return withTx([STORES.settings], 'readonly', async ({ settings }) => {
    return await reqToPromise(settings.get(key));
  });
}

export async function setSetting(key, value) {
  return withTx([STORES.settings], 'readwrite', async ({ settings }) => {
    const row = { key, value, updatedAt: Date.now() };
    settings.put(row);
  });
}

export async function listMenuItems() {
  return withTx([STORES.menuItems], 'readonly', async ({ menuItems }) => {
    return await reqToPromise(menuItems.getAll());
  });
}

export async function getMenuItem(id) {
  return withTx([STORES.menuItems], 'readonly', async ({ menuItems }) => {
    return await reqToPromise(menuItems.get(id));
  });
}

export async function upsertMenuItem(item) {
  return withTx([STORES.menuItems], 'readwrite', async ({ menuItems }) => {
    menuItems.put(item);
  });
}

export async function deleteMenuItem(id) {
  return withTx([STORES.menuItems], 'readwrite', async ({ menuItems }) => {
    menuItems.delete(id);
  });
}

export async function createOrder(order, orderItems) {
  return withTx([STORES.orders, STORES.orderItems], 'readwrite', async ({ orders, orderItems: oi }) => {
    orders.add(order);
    for (const it of orderItems) oi.add(it);
  });
}

export async function getOrder(orderId) {
  return withTx([STORES.orders], 'readonly', async ({ orders }) => {
    return await reqToPromise(orders.get(orderId));
  });
}

export async function updateOrder(order) {
  return withTx([STORES.orders], 'readwrite', async ({ orders }) => {
    orders.put(order);
  });
}

export async function listOrderItemsByOrderId(orderId) {
  return withTx([STORES.orderItems], 'readonly', async ({ orderItems }) => {
    const idx = orderItems.index('by_orderId');
    return await reqToPromise(idx.getAll(orderId));
  });
}

export async function listPaidOrdersInRange(startMs, endMs) {
  return withTx([STORES.orders], 'readonly', async ({ orders }) => {
    const all = await reqToPromise(orders.getAll());
    return all.filter(o => o.status === 'PAID' && typeof o.paidAt === 'number' && o.paidAt >= startMs && o.paidAt < endMs);
  });
}

export async function listAllOrderItems() {
  return withTx([STORES.orderItems], 'readonly', async ({ orderItems }) => {
    return await reqToPromise(orderItems.getAll());
  });
}

export const STORE_NAMES = STORES;

