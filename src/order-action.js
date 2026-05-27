const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sync = require('./services/sync.orders');
const store = require('./services/order-store.service');

async function main() {
  const action = String(process.argv[2] || '').toLowerCase();
  const orderId = process.argv[3];
  if (!action || !orderId) throw new Error('Uso: node src/order-action.js <confirm|ready|dispatch|cancel|status|retry-li> <orderIdUaiRango>');
  let response;
  if (action === 'confirm') response = await sync.confirmarPedidoManual(orderId);
  else if (action === 'ready') response = await sync.marcarProntoRetirada(orderId);
  else if (action === 'dispatch') response = await sync.despacharPedido(orderId);
  else if (action === 'cancel') response = await sync.cancelarPedidoUaiRango(orderId, process.argv.slice(4).join(' ') || process.env.UAIRANGO_DEFAULT_CANCELLATION_REASON);
  else if (action === 'retry-li') response = await sync.retryLiImport(orderId);
  else if (action === 'status') response = store.getOrder(orderId);
  else throw new Error(`Ação inválida: ${action}`);
  console.log(JSON.stringify({ ok: true, action, orderId, response }, null, 2));
}
main().catch((error) => { console.error(JSON.stringify(error.response?.data || error.message, null, 2)); process.exit(1); });
