const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, '../../orders-hub-db.json');

function now() { return new Date().toISOString(); }
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function clone(obj) { return JSON.parse(JSON.stringify(obj ?? null)); }
function defaultDb() {
  return {
    version: 3,
    orders: {},
    products: {},
    events: {},
    counters: { created: 0 },
    updatedAt: now(),
  };
}
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return defaultDb();
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      ...defaultDb(),
      ...parsed,
      orders: parsed.orders || {},
      products: parsed.products || {},
      events: parsed.events || {},
      counters: parsed.counters || { created: Object.keys(parsed.orders || {}).length },
    };
  } catch (error) {
    return { ...defaultDb(), readError: error.message };
  }
}
function writeDb(db) {
  db.updatedAt = now();
  ensureDir(DB_FILE);
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  return db;
}
function nextHubNumber(db) {
  const current = Number(db.counters?.created || 0) + 1;
  db.counters = { ...(db.counters || {}), created: current };
  return `UAI-${String(current).padStart(6, '0')}`;
}
function getOrder(orderId) {
  const db = readDb();
  return db.orders[String(orderId)] || null;
}
function listOrders({ limit = 50, status, q } = {}) {
  const db = readDb();
  let orders = Object.values(db.orders || {});
  if (status) orders = orders.filter((o) => String(o.status || '').toLowerCase() === String(status).toLowerCase());
  if (q) {
    const term = String(q).toLowerCase();
    orders = orders.filter((o) => JSON.stringify({ orderId: o.orderId, hubNumber: o.hubNumber, reference: o.reference, customerName: o.customerName, status: o.status }).toLowerCase().includes(term));
  }
  return orders
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, Number(limit) || 50);
}
function upsertOrder(orderId, patch = {}) {
  const db = readDb();
  const key = String(orderId);
  const previous = db.orders[key] || { orderId: key, hubNumber: nextHubNumber(db), createdAt: now(), logs: [] };
  const next = {
    ...previous,
    ...clone(patch),
    orderId: key,
    hubNumber: previous.hubNumber,
    createdAt: previous.createdAt,
    updatedAt: now(),
    logs: previous.logs || [],
  };
  db.orders[key] = next;
  writeDb(db);
  return next;
}
function appendLog(orderId, type, data = {}) {
  const db = readDb();
  const key = String(orderId);
  const previous = db.orders[key] || { orderId: key, hubNumber: nextHubNumber(db), createdAt: now(), logs: [] };
  previous.logs = Array.isArray(previous.logs) ? previous.logs : [];
  previous.logs.push({ at: now(), type, data: clone(data) });
  if (previous.logs.length > 300) previous.logs = previous.logs.slice(-300);
  previous.updatedAt = now();
  db.orders[key] = previous;
  writeDb(db);
  return previous;
}
function markEvent(event, patch = {}) {
  const db = readDb();
  const key = String(event.id || `${event.orderId}-${event.code}-${event.createdAt}`);
  db.events[key] = {
    ...(db.events[key] || {}),
    id: event.id,
    code: event.code,
    fullCode: event.fullCode,
    orderId: event.orderId,
    merchantId: event.merchantId,
    createdAt: event.createdAt,
    updatedAt: now(),
    ...clone(patch),
  };
  writeDb(db);
  return db.events[key];
}
function getEvent(eventId) {
  const db = readDb();
  return db.events[String(eventId)] || null;
}
function upsertProduct(liProductId, patch = {}) {
  const db = readDb();
  const key = String(liProductId);
  const previous = db.products[key] || { liProductId: key, createdAt: now(), logs: [] };
  const next = {
    ...previous,
    ...clone(patch),
    liProductId: key,
    createdAt: previous.createdAt,
    updatedAt: now(),
    logs: previous.logs || [],
  };
  next.logs.push({ at: now(), type: patch.ok === false ? 'sync_error' : 'sync_ok', data: clone(patch) });
  if (next.logs.length > 80) next.logs = next.logs.slice(-80);
  db.products[key] = next;
  writeDb(db);
  return next;
}
function listProducts({ limit = 100, status, q } = {}) {
  const db = readDb();
  let products = Object.values(db.products || {});
  if (status) products = products.filter((p) => String(p.status || '').toLowerCase() === String(status).toLowerCase());
  if (q) {
    const term = String(q).toLowerCase();
    products = products.filter((p) => JSON.stringify({ liProductId: p.liProductId, name: p.name, uaiProductId: p.uaiProductId, uaiItemId: p.uaiItemId, status: p.status }).toLowerCase().includes(term));
  }
  return products
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, Number(limit) || 100);
}
function getProduct(liProductId) {
  const db = readDb();
  return db.products[String(liProductId)] || null;
}
function dashboardStats() {
  const db = readDb();
  const orders = Object.values(db.orders || {});
  const products = Object.values(db.products || {});
  const byStatus = orders.reduce((acc, o) => {
    const s = o.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const productsByStatus = products.reduce((acc, p) => {
    const s = p.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return {
    totalOrders: orders.length,
    byStatus,
    totalProducts: products.length,
    productsByStatus,
    totalEvents: Object.keys(db.events || {}).length,
    updatedAt: db.updatedAt,
    dbFile: DB_FILE,
  };
}

module.exports = {
  DB_FILE,
  readDb,
  writeDb,
  getOrder,
  listOrders,
  upsertOrder,
  appendLog,
  markEvent,
  getEvent,
  upsertProduct,
  listProducts,
  getProduct,
  dashboardStats,
};
