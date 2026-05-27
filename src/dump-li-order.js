const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const li = require("./services/lojaintegrada.service");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const pedidoId = process.argv[2] || process.env.LI_TEMPLATE_ORDER_ID;

  if (!pedidoId) {
    throw new Error("Informe o ID/número interno do pedido da LI. Exemplo: npm run li:pedido -- 401");
  }

  const pedido = await li.buscarPedido(pedidoId);
  const outDir = path.resolve(__dirname, "../tmp");
  ensureDir(outDir);

  const outFile = path.join(outDir, `li-order-${pedidoId}.json`);
  const templateFile = path.join(outDir, "li-order-template.json");

  fs.writeFileSync(outFile, JSON.stringify(pedido, null, 2));
  fs.writeFileSync(templateFile, JSON.stringify(pedido, null, 2));

  console.log(JSON.stringify({
    ok: true,
    pedidoId,
    savedAs: outFile,
    template: templateFile
  }, null, 2));
}

main().catch((error) => {
  console.error("Erro ao buscar pedido da LI:");
  console.error(JSON.stringify(error.response?.data || error.message, null, 2));
  process.exit(1);
});
