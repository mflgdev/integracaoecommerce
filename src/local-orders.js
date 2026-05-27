const store = require('./services/order-store.service');

const action = String(process.argv[2] || 'list').toLowerCase();
const arg = process.argv[3];

if (action === 'show') {
  if (!arg) throw new Error('Uso: npm run order:show -- <orderId>');
  console.log(JSON.stringify(store.getOrder(arg), null, 2));
} else if (action === 'stats') {
  console.log(JSON.stringify(store.dashboardStats(), null, 2));
} else {
  const limit = Number(arg || 50);
  console.log(JSON.stringify(store.listOrders({ limit }), null, 2));
}
