const li = require('./services/lojaintegrada.service');

async function main() {
  const sku = process.argv[2];
  if (!sku) throw new Error('Use: npm run li:produto-sku -- SKU');

  const bySku = await li.buscarProdutoPorSku(sku).catch((error) => ({ error: error.response?.data || error.message }));
  console.log('\n[LI] Resultado por SKU:');
  console.log(JSON.stringify(bySku, null, 2));

  if (/^\d+$/.test(String(sku))) {
    const byId = await li.buscarProduto(sku).catch((error) => ({ error: error.response?.data || error.message }));
    console.log('\n[LI] Resultado por ID interno:');
    console.log(JSON.stringify(byId, null, 2));
  }
}

main().catch((error) => {
  console.error(error.response?.data || error.message);
  process.exit(1);
});
