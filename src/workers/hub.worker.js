const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { processarEventosUaiRango } = require('../services/sync.orders');
const { sincronizarTodosProdutos } = require('../services/sync.products');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ORDERS_INTERVAL_MS = Number(process.env.ORDERS_WORKER_INTERVAL_MS || 30000);
const PRODUCTS_INTERVAL_MS = Number(process.env.PRODUCTS_WORKER_INTERVAL_MS || 300000);

let runningOrders = false;
let runningProducts = false;

async function cicloPedidos() {
  if (runningOrders) return;
  runningOrders = true;
  try {
    const result = await processarEventosUaiRango();
    console.log(`[${new Date().toISOString()}] Pedidos | eventos: ${result.total} | processados: ${result.processed}`);
    if (result.total) console.log(JSON.stringify(result.results, null, 2));
  } catch (error) {
    console.error('[worker:orders] erro:', JSON.stringify(error.response?.data || error.message, null, 2));
  } finally {
    runningOrders = false;
  }
}

async function cicloProdutos() {
  if (runningProducts) return;
  runningProducts = true;
  try {
    const result = await sincronizarTodosProdutos();
    const ok = result.filter((r) => r.ok).length;
    const fail = result.length - ok;
    console.log(`[${new Date().toISOString()}] Produtos | total: ${result.length} | ok: ${ok} | erro: ${fail}`);
  } catch (error) {
    console.error('[worker:products] erro:', JSON.stringify(error.response?.data || error.message, null, 2));
  } finally {
    runningProducts = false;
  }
}

async function loop(nome, intervalo, fn) {
  console.log(`${nome} iniciado. Intervalo: ${intervalo}ms`);
  while (true) {
    await fn();
    await sleep(intervalo);
  }
}

async function main() {
  console.log('Worker HUB 24h iniciado: pedidos UaiRango -> LI + produtos LI -> UaiRango');
  await Promise.all([
    loop('Pedidos', ORDERS_INTERVAL_MS, cicloPedidos),
    loop('Produtos', PRODUCTS_INTERVAL_MS, cicloProdutos),
  ]);
}

main();
