const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const li = require("./services/lojaintegrada.service");

async function main() {
  const limit = Number(process.argv[2] || 10);
  const pedidos = await li.listarPedidos({ limit, offset: 0 });
  console.log(JSON.stringify(pedidos, null, 2));
}

main().catch((error) => {
  console.error("Erro ao listar pedidos da LI:");
  console.error(JSON.stringify(error.response?.data || error.message, null, 2));
  process.exit(1);
});
