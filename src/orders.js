async function buscarPedido(api, orderId) {
  const response = await api.get(`/order/v1.0/orders/${orderId}`);
  return response.data;
}

async function confirmarPedido(api, orderId) {
  const response = await api.post(`/order/v1.0/orders/${orderId}/confirm`);
  return response.data;
}

async function prontoParaRetirada(api, orderId) {
  const response = await api.post(`/order/v1.0/orders/${orderId}/readyToPickup`);
  return response.data;
}

async function despacharPedido(api, orderId) {
  const response = await api.post(`/order/v1.0/orders/${orderId}/dispatch`);
  return response.data;
}

async function listarMotivosCancelamento(api, orderId) {
  const response = await api.get(`/order/v1.0/orders/${orderId}/cancellationReasons`);
  return response.data;
}

async function solicitarCancelamento(api, orderId, payload) {
  const response = await api.post(
    `/order/v1.0/orders/${orderId}/requestCancellation`,
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
  buscarPedido,
  confirmarPedido,
  prontoParaRetirada,
  despacharPedido,
  listarMotivosCancelamento,
  solicitarCancelamento,
};