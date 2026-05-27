const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { processarEventosUaiRango } = require("../services/sync.orders");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const INTERVAL_MS = Number(process.env.ORDERS_WORKER_INTERVAL_MS || 30000);

async function runOnce() {
  const result = await processarEventosUaiRango();
  const now = new Date().toISOString();

  if (result.total > 0) {
    console.log(`[${now}] Eventos: ${result.total} | Pedidos importados: ${result.processed}`);
    console.log(JSON.stringify(result.results, null, 2));
  } else {
    console.log(`[${now}] Nenhum evento novo.`);
  }
}

async function main() {
  console.log("Worker de pedidos UaiRango -> Loja Integrada iniciado.");
  console.log(`Intervalo: ${INTERVAL_MS}ms`);

  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Erro no worker de pedidos:");
      console.error(error.response?.data || error.message);
    }

    await sleep(INTERVAL_MS);
  }
}

main();
