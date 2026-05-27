async function listarMerchants(api) {
  const response = await api.get("/merchant/v1.0/merchants");
  return response.data;
}

async function buscarMerchant(api, merchantId) {
  const response = await api.get(`/merchant/v1.0/merchants/${merchantId}`);
  return response.data;
}

async function buscarStatusMerchant(api, merchantId) {
  const response = await api.get(`/merchant/v1.0/merchants/${merchantId}/status`);
  return response.data;
}

async function buscarStatusMerchantPorOperacao(api, merchantId, operacao) {
  const response = await api.get(
    `/merchant/v1.0/merchants/${merchantId}/status/${operacao}`
  );
  return response.data;
}

function normalizarPayloadStatusMerchant(payload = {}) {
  const operation = String(payload.operation || payload.operacao || 'DELIVERY').toUpperCase();

  let status = payload.status;
  if (!status && typeof payload.available === 'boolean') {
    status = payload.available ? 'AVAILABLE' : 'UNAVAILABLE';
  }
  if (!status && typeof payload.disponivel === 'boolean') {
    status = payload.disponivel ? 'AVAILABLE' : 'UNAVAILABLE';
  }
  status = String(status || 'UNAVAILABLE').toUpperCase();

  return { status, operation };
}

function isoNowMinus(minutes = 1) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoNowPlus(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function listarInterrupcoesMerchant(api, merchantId) {
  const response = await api.get(`/merchant/v1.0/merchants/${merchantId}/interruptions`);
  return response.data;
}

async function criarInterrupcaoMerchant(api, merchantId, payload = {}) {
  const body = {
    description: payload.description || payload.motivo || 'Homologação - pausa temporária via hub',
    start: payload.start || isoNowMinus(1),
    end: payload.end || isoNowPlus(Number(payload.durationMinutes || 60)),
  };
  const response = await api.post(`/merchant/v1.0/merchants/${merchantId}/interruptions`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return { payloadEnviado: body, data: response.data };
}

async function removerInterrupcaoMerchant(api, merchantId, interruptionId) {
  const response = await api.delete(`/merchant/v1.0/merchants/${merchantId}/interruptions/${interruptionId}`);
  return response.data || { deleted: true, interruptionId };
}

async function reabrirMerchantRemovendoInterrupcoes(api, merchantId) {
  const interrupcoes = await listarInterrupcoesMerchant(api, merchantId);
  const lista = Array.isArray(interrupcoes) ? interrupcoes : (interrupcoes.items || interrupcoes.data || []);
  const removidas = [];
  for (const item of lista) {
    const id = item.id || item.interruptionId || item.identifier;
    if (!id) continue;
    try {
      await removerInterrupcaoMerchant(api, merchantId, id);
      removidas.push(id);
    } catch (error) {
      removidas.push({ id, erro: error.response?.data || error.message });
    }
  }
  return { removidas, interrupcoesEncontradas: lista };
}

async function atualizarStatusMerchant(api, merchantId, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const body = payload && Object.keys(payload).length ? payload : {
    status: 'AVAILABLE',
    operations: [
      { name: 'DELIVERY', status: 'AVAILABLE', estimatedTime: 15 },
      { name: 'TAKEOUT', status: 'UNAVAILABLE', estimatedTime: 10 },
    ],
  };

  const response = await api.put(`/merchant/v1.0/merchants/${merchantId}`, body, { headers });
  return {
    ok: true,
    modo: 'PUT /merchant/v1.0/merchants/{merchantId}',
    payloadEnviado: body,
    data: response.data,
  };
}

module.exports = {
  listarMerchants,
  buscarMerchant,
  buscarStatusMerchant,
  buscarStatusMerchantPorOperacao,
  atualizarStatusMerchant,
  listarInterrupcoesMerchant,
  criarInterrupcaoMerchant,
  removerInterrupcaoMerchant,
};