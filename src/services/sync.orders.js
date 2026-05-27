const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const li = require("./lojaintegrada.service");
const uai = require("./uairango.service");
const store = require("./order-store.service");

const boolEnv = (name, fallback = false) => {
  if (process.env[name] === undefined) return fallback;
  return String(process.env[name]).toLowerCase() === "true";
};

const onlyDigits = (v = "") => String(v || "").replace(/\D+/g, "");

function envBool(name, fallback = false) {
  if (process.env[name] === undefined) return fallback;
  return String(process.env[name]).trim().toLowerCase() === "true";
}

function parseMoney(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function makeMoney(value) {
  return Number(parseMoney(value, 0).toFixed(4));
}

function isInvalidPlaceholder(value) {
  if (value === undefined || value === null) return true;

  const s = String(value).trim();
  if (!s) return true;

  const normalized = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    normalized.includes("nao informado") ||
    normalized.includes("nao informada") ||
    normalized === "undefined" ||
    normalized === "null" ||
    normalized === "[object object]"
  );
}

const first = (...v) => v.find((x) => !isInvalidPlaceholder(x));

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function readText(value) {
  if (isInvalidPlaceholder(value)) return null;

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    return first(
      value.full,
      value.value,
      value.number,
      value.phone,
      value.cellPhone,
      value.mobilePhone,
      value.formatted,
      value.name
    );
  }

  return String(value).trim();
}

function customer(o = {}) {
  return o.customer || o.consumer || o.client || o.buyer || o.user || {};
}

function address(o = {}) {
  const d = o.delivery || o.shipping || {};
  return (
    d.address ||
    d.deliveryAddress ||
    o.address ||
    o.deliveryAddress ||
    o.shippingAddress ||
    o.destination?.address ||
    o.customer?.address ||
    o.buyer?.address ||
    {}
  );
}

function items(o = {}) {
  return Array.isArray(o.items)
    ? o.items
    : Array.isArray(o.orderItems)
      ? o.orderItems
      : Array.isArray(o.products)
        ? o.products
        : [];
}

function payments(o = {}) {
  return Array.isArray(o.payments)
    ? o.payments
    : Array.isArray(o.payment?.methods)
      ? o.payment.methods
      : o.payment
        ? [o.payment]
        : [];
}

function ref(o = {}, orderId) {
  return String(
    first(
      o.reference,
      o.shortReference,
      o.displayId,
      o.code,
      o.number,
      o.orderCode,
      orderId
    )
  );
}

function operation(o = {}) {
  return String(
    first(
      o.orderType,
      o.type,
      o.operation,
      o.delivery?.type,
      o.delivery?.mode,
      "DELIVERY"
    )
  ).toUpperCase();
}

function deliveryFee(o = {}) {
  return num(
    first(
      o.total?.deliveryFee,
      o.total?.shipping,
      o.delivery?.fee,
      o.delivery?.price,
      o.shipping?.price,
      o.shippingFee
    ),
    0
  );
}

function discount(o = {}) {
  return num(
    first(
      o.total?.discount,
      o.total?.discounts,
      o.discount,
      o.benefits?.total,
      o.coupon?.value
    ),
    0
  );
}

function total(o = {}) {
  return num(
    first(
      o.total?.orderAmount,
      o.total?.amount,
      o.total?.value,
      o.totalAmount,
      o.amount,
      o.value,
      o.price
    ),
    0
  );
}

function itemOptionTotal(i = {}) {
  const opts = Array.isArray(i.options) ? i.options : [];

  return opts.reduce((sum, opt) => {
    const price = num(first(opt.price, opt.totalPrice, opt.unitPrice), 0);
    const quantity = num(first(opt.quantity), 1);
    return sum + price * quantity;
  }, 0);
}

function mapItem(i = {}) {
  const p = i.product || i.item || {};

  const sku = String(
    first(
      i.externalCode,
      i.externalId,
      i.sku,
      p.externalCode,
      p.externalId,
      p.sku,
      i.productId,
      p.id,
      ""
    )
  ).trim();

  const quantity = num(first(i.quantity, i.amount, i.qty), 1);

  const totalPrice =
    num(
      first(
        i.totalPrice,
        i.total,
        i.price?.total,
        i.price?.amount,
        i.value?.total,
        i.subtotal,
        i.totalValue
      ),
      0
    ) || itemOptionTotal(i);

  let unitPrice = num(
    first(
      i.unitPrice,
      i.price?.unitValue,
      i.price?.unit,
      i.price?.value,
      typeof i.price === "number" ? i.price : null,
      i.value?.value,
      typeof i.value === "number" ? i.value : null
    ),
    0
  );

  if (!unitPrice && totalPrice && quantity) {
    unitPrice = totalPrice / quantity;
  }

  return {
    sku,
    externalCode: sku,
    name: first(i.name, p.name, i.description, "Produto UaiRango"),
    quantity,
    unitPrice,
    totalPrice: totalPrice || unitPrice * quantity,
    raw: i,
  };
}

function subtotal(o = {}) {
  const explicit = first(
    o.total?.itemsAmount,
    o.total?.items,
    o.subtotal,
    o.itemsTotal,
    o.totalItems
  );

  if (explicit !== undefined) return num(explicit, 0);

  return items(o)
    .map(mapItem)
    .reduce((s, i) => s + i.totalPrice, 0);
}

function mapPayment(p = {}, fallbackValue = 0) {
  const method = String(
    first(
      p.method,
      p.type,
      p.name,
      p.paymentMethod,
      p.paymentType,
      p.wallet?.name,
      "PAGAMENTOEXTERNO"
    )
  ).toUpperCase();

  const brand = first(
    p.brand,
    p.card?.brand,
    p.cardBrand,
    p.creditCard?.brand,
    p.debitCard?.brand
  );

  const changeFor = first(p.changeFor, p.cash?.changeFor, p.change, p.trocoPara);

  return {
    method,
    name: first(p.displayName, p.description, p.name, method),
    brand: brand || null,
    value: num(first(p.value, p.amount, p.total), fallbackValue),
    changeFor: changeFor ? num(changeFor, 0) : null,
    raw: p,
  };
}

function extrairOrderIdEvento(evento = {}) {
  return String(
    first(
      evento.orderId,
      evento.order_id,
      evento.order?.id,
      evento.order?.uuid,
      evento.resourceId,
      evento.resource_id,
      evento.entityId,
      evento.entity_id,
      evento.data?.orderId,
      evento.data?.order_id,
      evento.data?.id
    ) || ""
  );
}

function statusFromEvent(e) {
  return (
    {
      PLC: "placed",
      CFM: "confirmed",
      RTP: "ready_to_pickup",
      DSP: "dispatched",
      CAN: "cancelled",
      SPE: "separation_ended",
    }[String(e?.code || "").toUpperCase()] || "unknown"
  );
}

function resumirPedidoUai(o = {}, orderId) {
  const c = customer(o);
  const t = total(o);

  return {
    orderId: String(orderId),
    reference: ref(o, orderId),
    operation: operation(o),
    customerName: first(
      c.name,
      c.fullName,
      c.nome,
      o.customerName,
      "Cliente UaiRango"
    ),
    total: t,
    subtotal: subtotal(o),
    deliveryFee: deliveryFee(o),
    discount: discount(o),
    items: items(o).map(mapItem),
    payments: payments(o).map((p) => mapPayment(p, t)),
  };
}

async function resolverProductId(item) {
  
  const sku = String(item.externalCode || item.sku || '').trim();

  if (!sku) {
    throw new Error(`Item sem SKU/externalCode: ${item.name}`);
  }

  const produtoLI = await li.buscarProdutoPorIdExterno(sku, false);

  if (!produtoLI?.id) {
    throw new Error(`Produto LI não encontrado para id_externo/SKU ${sku}`);
  }

  console.log("[LI] Produto resolvido para item:", {
  sku,
  product_id: produtoLI.id,
  nome: produtoLI.nome,
});

  return produtoLI.id;
}

function formatMoneyBR(value) {
  return `R$ ${makeMoney(value).toFixed(2).replace(".", ",")}`;
}

function montarComentarioPedidoUairango(o = {}, orderId, resumo = {}) {
  const a = address(o);

  const rua = first(readText(a.street), readText(a.address), readText(a.name));
  const numero = first(readText(a.number), readText(a.numero), 'S/N');
  const bairro = first(readText(a.neighborhood), readText(a.district));
  const cidade = first(readText(a.city), readText(a.cidade));
  const uf = first(readText(a.state), readText(a.uf));
  const cep = first(readText(a.zipcode), readText(a.zipCode), readText(a.cep));

  const partes = [
    rua,
    numero ? `Nº ${numero}` : 'S/N',
    bairro,
    cidade && uf ? `${cidade}/${uf}` : cidade || uf,
    cep ? `CEP ${onlyDigits(cep)}` : null,
  ].filter((v) => !isInvalidPlaceholder(v));

  return partes.join(', ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

async function montarPayloadPedidoLojaIntegrada(o, orderId) {
  const resumo = resumirPedidoUai(o, orderId);
  const mappedItems = items(o).map(mapItem).filter((i) => i.sku);

  if (!mappedItems.length) {
    throw new Error(`Pedido ${orderId} sem itens com SKU/externalCode.`);
  }

  const rawOrderRef = ref(o, orderId);
  const orderRef = limparReferenciaLI(rawOrderRef || orderId);
  const marketPlaceId = limparReferenciaLI(`UAI-${orderRef}-${Date.now()}`);

  const resolvedItems = [];

  for (const item of mappedItems) {
    const productId = await resolverProductId(item);

    resolvedItems.push({
      product_id: productId,
      quantity: makeMoney(item.quantity),
      unit_value: makeMoney(item.unitPrice),
      line_value: makeMoney(item.totalPrice || item.unitPrice * item.quantity),
    });
  }

  const grossFromItems = makeMoney(
    resolvedItems.reduce(
      (sum, item) => sum + parseMoney(item.line_value, 0),
      0
    )
  );

  const frete = makeMoney(resumo.deliveryFee || 0);
  const desc = makeMoney(resumo.discount || 0);
  const totalUai = makeMoney(resumo.total || grossFromItems + frete - desc);
  const grossUai = grossFromItems;

  return {
    buyer: {
      name: "Rafael Colombo Peres",
      email: "meupetssp@gmail.com",
      document: onlyDigits("05942096686"),
      external_id: "88512712",
      phone: onlyDigits("35999057881"),
      type: "CPF",
      cellPhone: onlyDigits("35999057881"),
    },

    shipping: {
      address: {
        name: "Rafael Colombo Peres",
        address: "Rua Joaquim José Cardoso",
        country: "BR",
        complement: "Loja Petshop",
        district: "Vila Ipê",
        city: "São Sebastião do Paraíso",
        state: "MG",
        zipcode: onlyDigits("37954246"),
        number: "245",
      },
      option: "motoboy",
    },

    amount: {
      discount: desc || null,
      freight: frete,
      fees: null,
      total: totalUai,
      gross: grossUai,
    },

    items: resolvedItems,

    info: {
      status: String(process.env.LI_IMPORTED_ORDER_STATUS_ID || "2"),
      marketPlaceId,
      reference: "integrator-li/UaiRango",
      comment: montarComentarioPedidoUairango(o, orderId, resumo).slice(0, 50),
    },

    integration_data: {
      integrator: "integrator_li",
      marketplace: "UaiRango",
      external_id: Number(Date.now()),
      unique_id: null,
    },
  };
}

function limparReferenciaLI(reference) {
  return (
    String(reference || "")
      .replace(/[^A-Za-z0-9_.-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `UAI-${Date.now()}`
  );
}

async function tentarCriarPedidoNaLojaIntegrada(pedidoUai, orderId) {
  const existing = store.getOrder(orderId);

  if (existing?.li?.imported) {
    return {
      skipped: true,
      reason: "pedido_ja_importado_na_li",
      liOrderId:
        existing.li.orderId ||
        existing.li.response?.response?.id ||
        existing.li.response?.id ||
        null,
      liOrderNumber:
        existing.li.number ||
        existing.li.response?.response?.number ||
        existing.li.response?.number ||
        null,
    };
  }

  const payload = await montarPayloadPedidoLojaIntegrada(pedidoUai, orderId);

  console.log("[LI] Payload final UaiRango -> LI:");
  console.log(JSON.stringify(payload, null, 2));

  if (boolEnv("ORDERS_SYNC_DRY_RUN", false)) {
    return { dryRun: true, payload };
  }

  if (!boolEnv("LI_ENABLE_EXTERNAL_ORDER_CREATE", true)) {
    return {
      skipped: true,
      reason: "LI_ENABLE_EXTERNAL_ORDER_CREATE=false",
      payload,
    };
  }

  return await li.criarPedidoExterno(payload);
}

async function criarOuAtualizarPedidoHub(pedidoUai, orderId, evento = null) {
  const resumo = resumirPedidoUai(pedidoUai, orderId);
  const existing = store.getOrder(orderId);
  const liPayload = await montarPayloadPedidoLojaIntegrada(pedidoUai, orderId);

  const order = store.upsertOrder(orderId, {
    source: "UAIRANGO",
    merchantId:
      evento?.merchantId ||
      existing?.merchantId ||
      process.env.UAIRANGO_MERCHANT_ID,
    status: existing?.status || "placed",
    lastEventCode: evento?.code || existing?.lastEventCode || null,
    lastEventId: evento?.id || existing?.lastEventId || null,
    reference: resumo.reference,
    operation: resumo.operation,
    customerName: resumo.customerName,
    total: resumo.total,
    summary: resumo,
    liPayload,
    rawUairango: boolEnv("ORDERS_STORE_RAW_UAIRANGO", false)
      ? pedidoUai
      : existing?.rawUairango,
  });

  store.appendLog(orderId, existing ? "hub_order_updated" : "hub_order_created", {
    eventId: evento?.id || null,
    resumo,
  });

  return order;
}

async function confirmarNaUairangoSePossivel(api, orderId) {
  try {
    const response = await uai.confirmarPedido(api, orderId);

    store.upsertOrder(orderId, {
      status: "confirmed",
      uairangoStatus: "confirmed",
    });

    store.appendLog(orderId, "uairango_confirm_success", { response });

    return { ok: true, response };
  } catch (error) {
    const details = error.response?.data || error.message;

    store.appendLog(orderId, "uairango_confirm_error", { error: details });

    return { ok: false, error: details };
  }
}

async function processarEventoPedido(api, evento) {
  const orderId = extrairOrderIdEvento(evento);

  if (!evento?.id || !orderId) {
    return { ignored: true, motivo: "evento_sem_id_ou_orderId", evento };
  }

  const previousEvent = store.getEvent(evento.id);

  if (previousEvent?.status === "acked") {
    return {
      ignored: true,
      motivo: "evento_ja_ackado",
      eventoId: evento.id,
      orderId,
    };
  }

  store.markEvent(evento, {
    status: "received",
    mappedStatus: statusFromEvent(evento),
  });

  if (String(evento.code).toUpperCase() !== "PLC") {
    store.upsertOrder(orderId, {
      source: "UAIRANGO",
      merchantId: evento.merchantId,
      status: statusFromEvent(evento),
      lastEventCode: evento.code,
      lastEventId: evento.id,
      uairangoStatus: statusFromEvent(evento),
    });

    store.appendLog(orderId, "uairango_status_event", { evento });
    store.markEvent(evento, { status: "processed", action: "status_updated" });

    return {
      processed: true,
      statusOnly: true,
      orderId,
      eventId: evento.id,
      localStatus: statusFromEvent(evento),
    };
  }

  const pedidoUai = await uai.buscarPedido(api, orderId);

  await criarOuAtualizarPedidoHub(pedidoUai, orderId, evento);

  // IMPORTANTE PARA HOMOLOGAÇÃO E FLUXO REAL:
  // Ao receber PLC via polling, o hub apenas salva o pedido e envia ACK do evento.
  // Ele NÃO confirma automaticamente na Uai Rango e NÃO envia automaticamente para a Loja Integrada.
  // A confirmação e o envio para a Loja Integrada acontecem somente quando você clicar em Confirmar.
  store.upsertOrder(orderId, {
    status: "pending_confirmation",
    uairangoStatus: "placed",
    li: {
      ...(store.getOrder(orderId)?.li || {}),
      imported: false,
      skipped: true,
      reason: "aguardando_confirmacao_manual",
      updatedAt: new Date().toISOString(),
    },
  });

  store.appendLog(orderId, "awaiting_manual_confirmation", {
    motivo: "Pedido recebido por polling. Aguardando confirmação manual para enviar à Loja Integrada.",
  });

  store.markEvent(evento, {
    status: "processed",
    action: "hub_saved_waiting_manual_confirmation",
    liImported: false,
  });

  return {
    processed: true,
    orderId,
    eventId: evento.id,
    hubSaved: true,
    awaitingManualConfirmation: true,
    liImported: false,
    confirmResult: null,
  };
}

async function processarEventosUaiRango() {
  const api = await uai.getApi();
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;

  if (!merchantId) {
    throw new Error("Informe UAIRANGO_MERCHANT_ID no .env");
  }

  const listaEventos = await uai.buscarNovosEventos(api, merchantId, {
    types: process.env.UAIRANGO_ORDER_EVENT_TYPES || "PLC,CFM,RTP,DSP,CAN,SPE",
    groups: process.env.UAIRANGO_ORDER_EVENT_GROUPS || "ORDER_STATUS",
  });

  const eventos = Array.isArray(listaEventos) ? listaEventos : [];

  if (!eventos.length) {
    return { ok: true, total: 0, processed: 0, results: [] };
  }

  const results = [];

  for (const evento of eventos) {
    try {
      results.push(await processarEventoPedido(api, evento));
    } catch (error) {
      const orderId = extrairOrderIdEvento(evento);

      store.markEvent(evento, {
        status: "error",
        error: error.response?.data || error.message,
      });

      results.push({
        processed: false,
        eventId: evento.id,
        orderId,
        error: error.response?.data || error.message,
      });
    }
  }

  const ackErrors = boolEnv("ORDERS_ACK_EVENTS_WITH_ERROR", false);

  const eventosParaAck = eventos.filter((e) => {
    const ev = store.getEvent(e.id);
    return ev?.status === "processed" || (ackErrors && ev?.status === "error");
  });

  let acknowledgment = null;

  if (eventosParaAck.length) {
    acknowledgment = await uai.reconhecerEventos(api, eventosParaAck);
    eventosParaAck.forEach((e) =>
      store.markEvent(e, { status: "acked", acknowledgment })
    );
  }

  return {
    ok: true,
    total: eventos.length,
    processed: results.filter((r) => r.processed).length,
    acknowledgment,
    results,
  };
}

async function testarImportacaoPedido(orderId) {
  if (!orderId) {
    throw new Error(
      "Informe TEST_UAIRANGO_ORDER_ID no .env ou rode: node src/test-one-order.js <orderId>"
    );
  }

  const api = await uai.getApi();
  const pedidoUai = await uai.buscarPedido(api, orderId);

  const hubOrder = await criarOuAtualizarPedidoHub(pedidoUai, orderId, {
    code: "TEST",
    id: `test-${Date.now()}`,
    merchantId: process.env.UAIRANGO_MERCHANT_ID,
  });

  let liResult;

  try {
    liResult = await tentarCriarPedidoNaLojaIntegrada(pedidoUai, orderId);
  } catch (error) {
    liResult = { error: error.response?.data || error.message };
  }

  store.upsertOrder(orderId, {
    li: {
      enabled: boolEnv("LI_ENABLE_EXTERNAL_ORDER_CREATE", true),
      skipped: !!liResult?.skipped,
      imported: !!liResult?.imported || !!liResult?.id || !!liResult?.ok || false,
      response: liResult,
      updatedAt: new Date().toISOString(),
    },
  });

  const confirmResult = boolEnv("UAIRANGO_CONFIRM_ORDER_AFTER_LOCAL_SAVE", false)
    ? await confirmarNaUairangoSePossivel(api, orderId)
    : null;

  return {
    ok: true,
    mode: "hub",
    orderId,
    hubOrder: store.getOrder(orderId) || hubOrder,
    li: liResult,
    confirmResult,
  };
}

async function importarPedidoParaLojaIntegradaAposConfirmacao(api, orderId) {
  const pedidoUai = await uai.buscarPedido(api, orderId);

  await criarOuAtualizarPedidoHub(pedidoUai, orderId, {
    code: "MANUAL_CONFIRM",
    id: `manual-confirm-${orderId}-${Date.now()}`,
    merchantId: process.env.UAIRANGO_MERCHANT_ID,
  });

  try {
    const liResult = await tentarCriarPedidoNaLojaIntegrada(pedidoUai, orderId);

    store.upsertOrder(orderId, {
      status: "confirmed",
      uairangoStatus: "confirmed",
      li: {
        enabled: boolEnv("LI_ENABLE_EXTERNAL_ORDER_CREATE", true),
        imported: !!liResult?.imported || !!liResult?.id || !!liResult?.ok || false,
        skipped: !!liResult?.skipped,
        response: liResult,
        orderId: liResult?.response?.id || liResult?.id || null,
        number: liResult?.response?.number || liResult?.number || null,
        updatedAt: new Date().toISOString(),
      },
    });

    store.appendLog(
      orderId,
      liResult?.skipped ? "li_import_skipped_after_manual_confirm" : "li_import_after_manual_confirm",
      liResult
    );

    return liResult;
  } catch (error) {
    const liError = error.response?.data || error.message;

    store.upsertOrder(orderId, {
      status: "confirmed_li_import_error",
      uairangoStatus: "confirmed",
      li: {
        enabled: true,
        imported: false,
        error: liError,
        updatedAt: new Date().toISOString(),
      },
    });

    store.appendLog(orderId, "li_import_error_after_manual_confirm", { error: liError });

    return { error: liError };
  }
}

async function confirmarPedidoManual(orderId) {
  const api = await uai.getApi();
  const confirmResponse = await uai.confirmarPedido(api, orderId);

  store.upsertOrder(orderId, {
    status: "confirmed",
    uairangoStatus: "confirmed",
  });

  store.appendLog(orderId, "manual_confirm", { response: confirmResponse });

  const liResult = await importarPedidoParaLojaIntegradaAposConfirmacao(api, orderId);

  return {
    ok: true,
    orderId,
    confirmResponse,
    li: liResult,
    message: "Pedido confirmado manualmente e enviado para a Loja Integrada.",
  };
}

async function marcarProntoRetirada(orderId) {
  const api = await uai.getApi();
  const r = await uai.prontoParaRetirada(api, orderId);

  store.upsertOrder(orderId, {
    status: "ready_to_pickup",
    uairangoStatus: "ready_to_pickup",
  });

  store.appendLog(orderId, "manual_ready_to_pickup", { response: r });

  return r;
}

async function despacharPedido(orderId) {
  const api = await uai.getApi();
  const r = await uai.despacharPedido(api, orderId);

  store.upsertOrder(orderId, {
    status: "dispatched",
    uairangoStatus: "dispatched",
  });

  store.appendLog(orderId, "manual_dispatch", { response: r });

  return r;
}

async function cancelarPedidoUaiRango(orderId, reason = "Cancelado pelo integrador") {
  const api = await uai.getApi();
  const motivos = await uai.listarMotivosCancelamento(api, orderId);
  const m = Array.isArray(motivos) ? motivos[0] : motivos?.[0];

  const cancellationCode = Number(
    first(m?.code, m?.id, process.env.UAIRANGO_DEFAULT_CANCELLATION_CODE)
  );

  if (!cancellationCode) {
    return {
      ignored: true,
      motivo: "pedido_sem_motivo_de_cancelamento_disponivel",
      motivos,
    };
  }

  const r = await uai.solicitarCancelamento(api, orderId, {
    cancellationCode,
    reason,
  });

  store.upsertOrder(orderId, {
    status: "cancelled",
    uairangoStatus: "cancelled",
  });

  store.appendLog(orderId, "manual_cancel", {
    cancellationCode,
    reason,
    response: r,
  });

  return r;
}

async function atualizarStatusUaiRangoAPartirDaPedidoLI(pedidoLI, orderIdUai) {
  const situacao = pedidoLI?.situacao || {};
  const codigo = String(situacao.codigo || "").toLowerCase();

  if (!orderIdUai) throw new Error("orderIdUai obrigatório");

  if (situacao.cancelado || codigo.includes("cancel")) {
    return await cancelarPedidoUaiRango(
      orderIdUai,
      process.env.UAIRANGO_DEFAULT_CANCELLATION_REASON ||
        "Cancelado na Loja Integrada"
    );
  }

  if (codigo.includes("pronto") || codigo.includes("retirada")) {
    return await marcarProntoRetirada(orderIdUai);
  }

  if (
    codigo.includes("enviado") ||
    codigo.includes("despach") ||
    codigo.includes("transporte") ||
    codigo.includes("entregue")
  ) {
    return await despacharPedido(orderIdUai);
  }

  if (
    codigo.includes("separacao") ||
    codigo.includes("prepar") ||
    situacao.aprovado
  ) {
    return await confirmarPedidoManual(orderIdUai);
  }

  return { ignored: true, motivo: "situacao_sem_mapeamento", situacao };
}

async function retryLiImport(orderId) {
  const order = store.getOrder(orderId);

  if (!order) {
    throw new Error(`Pedido ${orderId} não encontrado no hub local.`);
  }

  if (!order.liPayload) {
    throw new Error(
      `Pedido ${orderId} não possui liPayload salvo. Rode npm run test:order -- ${orderId} para regenerar.`
    );
  }

  if (!boolEnv("LI_ENABLE_EXTERNAL_ORDER_CREATE", true)) {
    return {
      skipped: true,
      reason: "LI_ENABLE_EXTERNAL_ORDER_CREATE=false",
      payload: order.liPayload,
    };
  }

  const response = await li.criarPedidoExterno(order.liPayload);

  store.upsertOrder(orderId, {
    li: {
      ...(order.li || {}),
      imported: true,
      response,
      updatedAt: new Date().toISOString(),
    },
  });

  store.appendLog(orderId, "li_retry_success", { response });

  return response;
}

module.exports = {
  processarEventosUaiRango,
  processarEventoPedido,
  atualizarStatusUaiRangoAPartirDaPedidoLI,
  montarPayloadPedidoLojaIntegrada,
  tentarCriarPedidoNaLojaIntegrada,
  testarImportacaoPedido,
  retryLiImport,
  confirmarPedidoManual,
  marcarProntoRetirada,
  despacharPedido,
  cancelarPedidoUaiRango,
  resumirPedidoUai,
};