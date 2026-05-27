const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const axios = require("axios");
const FormData = require("form-data");

const api = axios.create({
  baseURL: process.env.LI_BASE_URL || "https://api.awsli.com.br",
  timeout: 30000,
  headers: {
    Authorization: `chave_api ${process.env.LI_API_KEY} aplicacao ${process.env.LI_APP_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function unwrapSingle(data) {
  if (!data) return data;
  if (Array.isArray(data?.objects)) return data.objects[0] || null;
  if (data?.object) return data.object;
  return data;
}

function unwrapList(data) {
  if (!data) return [];
  if (Array.isArray(data?.objects)) return data.objects;
  if (Array.isArray(data)) return data;
  return [];
}
async function listarProdutos(params = {}) {
  const response = await api.get("/v1/produto", { params });
  return response.data;
}

async function buscarProduto(produtoId, params = {}) {
  const response = await api.get(`/v1/produto/${produtoId}`, { params });
  return unwrapSingle(response.data);
}

async function buscarProdutoPorIdExterno(idExterno, descricaoCompleta = true) {
  const response = await api.get(`/v1/produto/${idExterno}`, {
    params: {
      id_externo: 1,
      ...(descricaoCompleta ? { descricao_completa: 1 } : {}),
    },
  });
  return response.data;
}

async function filtrarProdutos(params = {}) {
  const response = await api.get("/v1/produto", { params });
  return response.data;
}

async function buscarProdutoPorSku(sku) {
  const response = await api.get("/v1/produto", {
    params: { sku: String(sku), limit: 1, offset: 0 }
  });
  const list = unwrapList(response.data);
  return list[0] || null;
}

async function listarImagensProduto(produtoId) {
  const response = await api.get("/v1/produto_imagem/", {
    params: { produto: produtoId },
  });
  return response.data;
}

async function buscarImagemProduto(imagemId) {
  const response = await api.get(`/v1/produto_imagem/${imagemId}`);
  return response.data;
}

async function listarPrecos(params = {}) {
  const response = await api.get("/v1/produto_preco", { params });
  return response.data;
}

async function buscarPreco(produtoId, { idExterno = false } = {}) {
  const response = await api.get(`/v1/produto_preco/${produtoId}`, {
    params: idExterno ? { id_externo: 1 } : {},
  });
  return unwrapSingle(response.data);
}

async function listarPrecosSet(ids = [], { idExterno = false } = {}) {
  const response = await api.get(`/v1/produto_preco/set/${ids.join(";")}`, {
    params: idExterno ? { id_externo: 1 } : {},
  });
  return response.data;
}

async function listarEstoques(params = {}) {
  const response = await api.get("/v1/produto_estoque", { params });
  return response.data;
}

async function buscarEstoque(produtoId) {
  const response = await api.get(`/v1/produto_estoque/${produtoId}`);
  return unwrapSingle(response.data);
}

async function listarCategorias(params = {}) {
  const response = await api.get("/v1/categoria", { params });
  return response.data;
}

async function buscarCategoria(categoriaId, { idExterno = false } = {}) {
  const response = await api.get(`/v1/categoria/${categoriaId}`, {
    params: idExterno ? { id_externo: 1 } : {},
  });
  return response.data;
}

async function listarCategoriasSet(ids = [], { idExterno = false } = {}) {
  const response = await api.get(`/v1/categoria/set/${ids.join(";")}`, {
    params: idExterno ? { id_externo: 1 } : {},
  });
  return response.data;
}

async function listarPedidos(params = {}) {
  const response = await api.get("/v1/pedido", { params });
  return response.data;
}

async function buscarPedido(pedidoId, params = {}) {
  const response = await api.get(`/v1/pedido/${pedidoId}`, { params });
  return unwrapSingle(response.data);
}

async function cadastrarCliente(payload) {
  const response = await api.post("/v1/cliente", payload);
  return response.data;
}

function appendPedidoFields(data, payload) {
  const referencia = String(payload.referencia || payload.reference || payload.numero_externo || payload.id_externo || "");

  data.append("referencia", referencia);
  data.append("reference", referencia);
  data.append("id_externo", String(payload.id_externo || referencia));
  data.append("numero_externo", String(payload.numero_externo || referencia));
  data.append("origem", String(payload.origem || "UAIRANGO"));
  data.append("valor_total", String(payload.valor_total || 0));
  data.append("valor_subtotal", String(payload.valor_subtotal || 0));
  data.append("valor_envio", String(payload.valor_envio || 0));
  data.append("valor_desconto", String(payload.valor_desconto || 0));

  data.append("cliente", JSON.stringify(payload.cliente || {}));
  data.append("endereco_entrega", JSON.stringify(payload.endereco_entrega || {}));
  data.append("envios", JSON.stringify(payload.envios || []));
  data.append("pagamentos", JSON.stringify(payload.pagamentos || []));
  data.append("itens", JSON.stringify(payload.itens || []));
  data.append("marketplace_info", JSON.stringify(payload.marketplace_info || {}));
  data.append("cliente_obs", String(payload.cliente_obs || ""));

  const pedidoJson = JSON.stringify(payload);
  data.append("pedido", pedidoJson);
  data.append("payload", pedidoJson);
  data.append("sale", pedidoJson);
  return data;
}

function montarFormDataPedido(payload) {
  return appendPedidoFields(new FormData(), payload);
}

function montarUrlEncodedPedido(payload) {
  return appendPedidoFields(new URLSearchParams(), payload);
}

function montarJsonPedido(payload) {
  return payload;
}

function removerVazios(obj) {
  if (Array.isArray(obj)) return obj.map(removerVazios);
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = removerVazios(value);
  }
  return out;
}

// Versão usada pelo /v1/integration/sales.
// Diferente de removerVazios(), aqui mantemos `null`, porque a documentação da LI
// mostra `amount.discount` e `amount.fees` como null. Remover esses campos pode
// fazer o backend responder apenas com erro genérico.
function limparIntegrationSalesPayload(obj) {
  if (Array.isArray(obj)) return obj.map(limparIntegrationSalesPayload);
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = limparIntegrationSalesPayload(value);
  }
  return out;
}

function montarPedidoEnglish(payload) {
  const referencia = String(payload.referencia || payload.reference || payload.numero_externo || payload.id_externo || "");
  const cliente = payload.cliente || {};
  const endereco = payload.endereco_entrega || {};
  const pagamento = payload.pagamentos?.[0] || {};
  const envio = payload.envios?.[0] || {};
  return removerVazios({
    reference: referencia,
    referencia,
    external_id: String(payload.id_externo || referencia),
    externalId: String(payload.id_externo || referencia),
    number: String(payload.numero_externo || referencia),
    source: payload.origem || "UAIRANGO",
    total: payload.valor_total,
    subtotal: payload.valor_subtotal,
    shipping: payload.valor_envio,
    discount: payload.valor_desconto,
    notes: payload.cliente_obs,
    customer: { name: cliente.nome, email: cliente.email, phone: cliente.telefone_principal || cliente.telefone_celular, document: cliente.cpf || cliente.cnpj, cpf: cliente.cpf, cnpj: cliente.cnpj },
    client: { name: cliente.nome, email: cliente.email, phone: cliente.telefone_principal || cliente.telefone_celular, document: cliente.cpf || cliente.cnpj, cpf: cliente.cpf, cnpj: cliente.cnpj },
    shipping_address: { name: endereco.nome, street: endereco.endereco, address: endereco.endereco, number: endereco.numero, complement: endereco.complemento, reference: endereco.referencia, neighborhood: endereco.bairro, city: endereco.cidade, state: endereco.estado, zipcode: endereco.cep, zip_code: endereco.cep, country: endereco.pais || "Brasil" },
    address: { name: endereco.nome, street: endereco.endereco, address: endereco.endereco, number: endereco.numero, complement: endereco.complemento, reference: endereco.referencia, neighborhood: endereco.bairro, city: endereco.cidade, state: endereco.estado, zipcode: endereco.cep, zip_code: endereco.cep, country: endereco.pais || "Brasil" },
    shipment: { method: envio.forma_envio?.codigo || "UAIRANGO", name: envio.forma_envio?.nome || "UaiRango", price: envio.valor || 0, value: envio.valor || 0 },
    payment: { method: pagamento.forma_pagamento?.codigo || "PAGAMENTOEXTERNO", name: pagamento.forma_pagamento?.nome || "Pagamento Externo", value: pagamento.valor || payload.valor_total, brand: pagamento.bandeira || undefined, installments: pagamento.numero_parcelas || undefined },
    payments: (payload.pagamentos || []).map((p) => removerVazios({ method: p.forma_pagamento?.codigo || "PAGAMENTOEXTERNO", name: p.forma_pagamento?.nome || "Pagamento Externo", value: p.valor || payload.valor_total, brand: p.bandeira || undefined, installments: p.numero_parcelas || undefined })),
    items: (payload.itens || []).map((item) => removerVazios({ reference: String(item.referencia || item.reference || item.sku || item.id_externo || ""), referencia: String(item.referencia || item.reference || item.sku || item.id_externo || ""), sku: String(item.sku || item.referencia || item.reference || item.id_externo || ""), external_id: String(item.id_externo || item.sku || item.referencia || ""), name: item.nome, description: item.nome, quantity: item.quantidade, price: item.preco_venda, unit_price: item.preco_venda, total: item.preco_subtotal, subtotal: item.preco_subtotal })),
    marketplace_info: payload.marketplace_info,
  });
}

function montarPedidoMarketplaceLike(payload) {
  const base = removerVazios(payload);
  const referencia = String(payload.referencia || payload.reference || payload.numero_externo || payload.id_externo || "");
  return removerVazios({
    ...base,
    token: process.env.LI_MARKETPLACE_TOKEN || "uairango",
    tipo: "pedido_venda",
    id_externo: String(payload.id_externo || referencia),
    numero: referencia,
    numero_externo: referencia,
    referencia,
    integration_data: { source: "UAIRANGO", reference: referencia, external_id: String(payload.id_externo || referencia) },
    situacao: { id: 15, codigo: process.env.LI_IMPORTED_ORDER_STATUS || "pedido_em_separacao", nome: process.env.LI_IMPORTED_ORDER_STATUS_NAME || "Pedido em separação", aprovado: true, cancelado: false, final: false, notificar_comprador: false, padrao: false, situacao_alterada: true },
    marketplace_info: { integrador: "uairango", marketplace: "UAIRANGO", id_externo_unico: String(payload.id_externo || referencia), reference: referencia },
  });
}

function isIntegrationSalesPayload(payload = {}) {
  return !!(payload.buyer && payload.shipping && payload.amount && Array.isArray(payload.items) && payload.info && payload.integration_data);
}

function gerarTentativasJson(payload) {
  if (isIntegrationSalesPayload(payload)) {
    return [{ name: "json-integration-sales-docs", body: limparIntegrationSalesPayload(payload) }];
  }
  const base = removerVazios(payload);
  const english = montarPedidoEnglish(payload);
  const marketplace = montarPedidoMarketplaceLike(payload);
  return [
    { name: "json-marketplace-like", body: marketplace },
    { name: "json-venda-marketplace-like", body: { venda: marketplace } },
    { name: "json-pedido-marketplace-like", body: { pedido: marketplace } },
    { name: "json-base", body: base },
    { name: "json-english", body: english },
    { name: "json-sale-base", body: { sale: base } },
    { name: "json-sale-english", body: { sale: english } },
    { name: "json-pedido-base", body: { pedido: base } },
    { name: "json-order-english", body: { order: english } },
    { name: "json-data-base", body: { data: base } },
  ];
}

async function criarPedidoVenda(payload) {
  const endpoint = process.env.LI_ORDER_CREATE_ENDPOINT || "/v1/integration/sales";
  const format = String(process.env.LI_ORDER_CREATE_FORMAT || "json-auto").toLowerCase();
  const baseHeaders = { Authorization: `chave_api ${process.env.LI_API_KEY} aplicacao ${process.env.LI_APP_KEY}`, Accept: "application/json" };

  try {
    if (format === "json" || format === "json-auto" || format === "auto") {
      const tentativas = format === "json" ? [{ name: "json-base", body: montarJsonPedido(payload) }] : gerarTentativasJson(payload);
      const erros = [];
      for (const tentativa of tentativas) {
        try {
          if (process.env.LI_DEBUG_ORDER_PAYLOAD === "true") {
            console.log(`\n[LI] Tentando criar pedido: ${tentativa.name}`);
            console.log(`[LI] Endpoint: ${endpoint}`);
            console.log(JSON.stringify(tentativa.body, null, 2));
          }
          const response = await api.post(endpoint, tentativa.body, { headers: { ...baseHeaders, "Content-Type": "application/json" } });
          return { ok: true, strategy: tentativa.name, response: response.data };
        } catch (error) {
          const detalhe = error.response?.data || error.message;
          erros.push({ strategy: tentativa.name, error: detalhe });
          const texto = typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe);
          if (/duplicad|já existe|ja existe|already/i.test(texto)) throw error;
        }
      }
      const err = new Error(`Nenhum formato JSON foi aceito pela Loja Integrada em ${endpoint}`);
      err.details = erros;
      err.response = { data: { message: err.message, attempts: erros } };
      throw err;
    }

    if (format === "formdata") {
      const data = montarFormDataPedido(payload);
      const response = await api.post(endpoint, data, { headers: { ...data.getHeaders(), ...baseHeaders } });
      return response.data;
    }

    if (format === "urlencoded" || format === "form") {
      const data = montarUrlEncodedPedido(payload);
      const response = await api.post(endpoint, data.toString(), { headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded" } });
      return response.data;
    }

    throw new Error(`LI_ORDER_CREATE_FORMAT inválido: ${format}. Use json-auto, json, urlencoded ou formdata.`);
  } catch (error) {
    const detalhe = error.response?.data || error.details || error.message;
    error.message = `Erro ao criar pedido na Loja Integrada em ${endpoint} usando ${format}: ${JSON.stringify(detalhe)}`;
    throw error;
  }
}

async function alterarPedidoVenda(pedidoId, payload) {
  const endpointBase = process.env.LI_ORDER_CREATE_ENDPOINT || "/v1/integration/sales";
  const response = await api.put(`${endpointBase}/${pedidoId}`, payload);
  return response.data;
}

async function cadastrarWebhookPedido(payload) {
  const response = await api.put("/webhooks/v1/pedido", payload);
  return response.data;
}

async function deletarWebhookPedido(payload) {
  const response = await api.delete("/webhooks/v1/pedido", { data: payload });
  return response.data;
}

async function cadastrarWebhookProduto(payload) {
  const response = await api.put("/webhooks/v1/produto", payload);
  return response.data;
}

async function deletarWebhookProduto(payload) {
  const response = await api.delete("/webhooks/v1/produto", { data: payload });
  return response.data;
}

module.exports = {
  listarProdutos,
  buscarProduto,
  buscarProdutoPorIdExterno,
  buscarProdutoPorSku,
  filtrarProdutos,
  listarImagensProduto,
  buscarImagemProduto,
  listarPrecos,
  buscarPreco,
  listarPrecosSet,
  listarEstoques,
  buscarEstoque,
  listarCategorias,
  buscarCategoria,
  listarCategoriasSet,
  listarPedidos,
  buscarPedido,
  cadastrarCliente,
  criarPedidoVenda,
  criarPedidoExterno: criarPedidoVenda,
  alterarPedidoVenda,
  cadastrarWebhookPedido,
  deletarWebhookPedido,
  cadastrarWebhookProduto,
  deletarWebhookProduto,
};