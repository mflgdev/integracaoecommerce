function unwrapEventos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.objects)) return data.objects;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function buscarNovosEventos(api, merchantId, options = {}) {
  const {
    types = "PLC,CFM,RTP,DSP,CAN",
    groups = "ORDER_STATUS",
  } = options;

  const headers = {
    "x-polling-merchants": merchantId,
  };

  const params = {};
  if (types) params.types = types;
  if (groups) params.groups = groups;

  const response = await api.get("/events/v1.0/events:polling", {
    headers,
    params,
  });

  let eventos = unwrapEventos(response.data);
  const retrySemFiltro = String(process.env.UAIRANGO_EVENTS_RETRY_WITHOUT_FILTERS || "true") === "true";
  if (!eventos.length && retrySemFiltro && (types || groups)) {
    const responseSemFiltro = await api.get("/events/v1.0/events:polling", {
      headers,
    });
    eventos = unwrapEventos(responseSemFiltro.data);
  }

  if (String(process.env.UAIRANGO_DEBUG_EVENTS || "false") === "true") {
    console.log("[UAIRANGO] Eventos normalizados:", eventos.length);
    if (!eventos.length) console.log("[UAIRANGO] Resposta bruta events:polling:", JSON.stringify(response.data, null, 2));
  }

  return eventos;
}

async function reconhecerEventos(api, eventos) {
  const payload = eventos.map((evento) => ({
    id: evento.id,
  }));

  const response = await api.post(
    "/events/v1.0/events/acknowledgment",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

module.exports = {
  buscarNovosEventos,
  reconhecerEventos,
};
