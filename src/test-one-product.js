const li = require("./services/lojaintegrada.service");
const { sincronizarProduto } = require("./services/sync.products");
const uai = require("./services/uairango.service");

async function main() {
  try {
    const sku = "765545";
    const merchantId = process.env.UAIRANGO_MERCHANT_ID;
    const catalogId = process.env.UAIRANGO_CATALOG_ID;

    const api = await uai.getApi();

    console.log(`Buscando produto na Loja Integrada pelo SKU: ${sku}`);

    const resultadoBusca = await li.filtrarProdutos({
      sku,
      limit: 1,
      offset: 0,
      descricao_completa: 1,
    });

    const produtoResumo = resultadoBusca?.objects?.[0];

    if (!produtoResumo) {
      throw new Error(`Nenhum produto encontrado com SKU ${sku}`);
    }

    const produto = await li.buscarProduto(produtoResumo.id, {
      descricao_completa: 1,
    });

    console.log("Produto completo encontrado:");
    console.log(JSON.stringify(produto, null, 2));

    const result = await sincronizarProduto(produto, api, merchantId, catalogId);

    console.log("\nProduto exportado com sucesso:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log("\nERRO:");
    console.log(error.response?.data || error.message);
  }
}

main();