const li = require("./lojaintegrada.service");
const uai = require("./uairango.service");
const { statusItemFromEstoque } = require("./mapper");

async function sincronizarEstoquePorProduto(produtoId) {
  const api = await uai.getApi();
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;

  const estoque = await li.buscarEstoque(produtoId);
  const status = statusItemFromEstoque(estoque);

  const payload = [
    {
      externalCode: String(produtoId),
      status,
    },
  ];

  return await uai.editarStatusItem(api, merchantId, payload);
}

async function sincronizarTodosEstoques() {
  const api = await uai.getApi();
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;
  const estoques = await li.listarEstoques({ limit: 200, offset: 0 });

  const payload = (estoques?.objects || []).map((estoque) => {
    const produtoId = String(estoque?.produto || "").match(/\/produto\/(\d+)/)?.[1];
    return {
      externalCode: produtoId,
      status: statusItemFromEstoque(estoque),
    };
  }).filter((x) => x.externalCode);

  if (!payload.length) return [];

  return await uai.editarStatusItem(api, merchantId, payload);
}

module.exports = {
  sincronizarEstoquePorProduto,
  sincronizarTodosEstoques,
};