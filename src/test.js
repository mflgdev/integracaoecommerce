const { sincronizarTodosProdutos } = require("./services/sync.products");
const { sincronizarTodosEstoques } = require("./services/sync.stock");
const { processarEventosUaiRango } = require("./services/sync.orders");

async function main() {
  try {
    console.log("=== SINCRONIZANDO PRODUTOS ===");
    const produtos = await sincronizarTodosProdutos();
    console.log(JSON.stringify(produtos, null, 2));

    console.log("\n=== SINCRONIZANDO ESTOQUES ===");
    const estoques = await sincronizarTodosEstoques();
    console.log(JSON.stringify(estoques, null, 2));

    console.log("\n=== PROCESSANDO EVENTOS UAIRANGO ===");
    const pedidos = await processarEventosUaiRango();
    console.log(JSON.stringify(pedidos, null, 2));
  } catch (error) {
    console.error("Erro geral:");
    console.error(error.response?.data || error.message);
  }
}

main();