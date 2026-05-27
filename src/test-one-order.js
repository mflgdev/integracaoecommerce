const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { testarImportacaoPedido } = require("./services/sync.orders");

async function main() {
  try {
    const orderId = process.argv[2] || process.env.TEST_UAIRANGO_ORDER_ID;
    const result = await testarImportacaoPedido(orderId);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Erro no teste de pedido:");
    console.error(JSON.stringify(error.response?.data || error.message, null, 2));
    process.exitCode = 1;
  }
}

main();
