async function listarCatalogos(api, merchantId) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/catalogs`);
  return response.data;
}

async function verificarVersaoCatalogo(api, merchantId) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/catalog/version`);
  return response.data;
}

async function listarCategorias(api, merchantId, catalogId, includeItems = true) {
  const response = await api.get(
    `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
    {
      params: { includeItems },
    }
  );
  return response.data;
}

async function criarCategoria(api, merchantId, catalogId, payload) {
  const response = await api.post(
    `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function buscarCategoria(api, merchantId, catalogId, categoryId, includeItems = true) {
  const response = await api.get(
    `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${categoryId}`,
    {
      params: { includeItems },
    }
  );
  return response.data;
}

async function editarCategoria(api, merchantId, catalogId, categoryId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${categoryId}`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function listarItensDaCategoria(api, merchantId, categoryId) {
  const response = await api.get(
    `/catalog/v2.0/merchants/${merchantId}/categories/${categoryId}/items`
  );
  return response.data;
}

async function deletarCategoria(api, merchantId, categoryId, includeItems = false) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/categories/${categoryId}`,
    {
      params: { includeItems },
    }
  );
  return response.data;
}

async function listarProdutos(api, merchantId, page = 1, limit = 200) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/products`, {
    params: { page, limit },
  });
  return response.data;
}

async function criarProduto(api, merchantId, payload) {
  console.log("PAYLOAD criarProduto:");
  console.log(JSON.stringify(payload, null, 2));

  const response = await api.post(
    `/catalog/v2.0/merchants/${merchantId}/products`,
    payload
  );

  console.log("RESPOSTA criarProduto:");
  console.log(JSON.stringify(response.data, null, 2));

  return response.data;
}

async function editarProduto(api, merchantId, productId, payload) {
  console.log("PAYLOAD editarProduto:");
  console.log(JSON.stringify(payload, null, 2));

  const response = await api.put(
    `/catalog/v2.0/merchants/${merchantId}/products/${productId}`,
    payload
  );

  console.log("RESPOSTA editarProduto:");
  console.log(JSON.stringify(response.data, null, 2));

  return response.data;
}

async function deletarProduto(api, merchantId, productId) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/products/${productId}`
  );
  return response.data;
}

async function listarProdutosPorExternalCode(api, merchantId, externalCode) {
  const response = await api.get(
    `/catalog/v2.0/merchants/${merchantId}/products/externalCode/${encodeURIComponent(externalCode)}`
  );
  return response.data;
}

async function buscarProduto(api, merchantId, productId) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/product/${productId}`);
  return response.data;
}

async function deletarItem(api, merchantId, categoryId, productId) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/categories/${categoryId}/products/${productId}`
  );
  return response.data;
}

async function buscarItemFlat(api, merchantId, itemId) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/items/${itemId}/flat`);
  return response.data;
}

async function criarOuAtualizarItem(api, merchantId, payload) {
  const response = await api.put(
    `/catalog/v2.0/merchants/${merchantId}/items`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function editarPrecoItem(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/items/price`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function editarStatusItem(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/items/status`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function editarExternalCodeItem(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/items/externalCode`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function listarGruposOpcao(api, merchantId, includeOptions = true) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/optionGroups`, {
    params: { includeOptions },
  });
  return response.data;
}

async function atualizarGrupoOpcao(api, merchantId, optionGroupId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/optionGroups/${optionGroupId}`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function deletarGrupoOpcao(api, merchantId, optionGroupId, includeOptions = true) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/optionGroups/${optionGroupId}`,
    {
      params: { includeOptions },
    }
  );
  return response.data;
}

async function desassociarGrupoOpcaoProduto(api, merchantId, optionGroupId, productId, includeOptions = true) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/optionGroups/${optionGroupId}/products/${productId}`,
    {
      params: { includeOptions },
    }
  );
  return response.data;
}

async function atualizarStatusGrupoOpcao(api, merchantId, optionGroupId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/optionGroups/${optionGroupId}/status`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function deletarOpcao(api, merchantId, optionGroupId, productId) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/optionGroups/${optionGroupId}/products/${productId}/option`
  );
  return response.data;
}

async function atualizarPrecoOpcao(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/options/price`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function atualizarExternalCodeOpcao(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/options/externalCode`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function atualizarStatusOpcao(api, merchantId, payload) {
  const response = await api.patch(
    `/catalog/v2.0/merchants/${merchantId}/options/status`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function uploadImagem(api, merchantId, image) {
  try {
    // Remove the data: prefix if present
    const base64 = image.replace(/^data:image\/[^;]+;base64,/, '');
    const payload = { image: base64 };

    console.log("Tentando upload com payload image length:", base64.length);
    console.log("image tipo:", typeof base64);
    console.log("image início:", base64.slice(0, 50));

    const response = await api.post(
      `/catalog/v2.0/merchants/${merchantId}/image/upload`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.log("Falha no upload:");
    console.log("status:", error.response?.status);
    console.log("body:", JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

async function deletarImagem(api, merchantId, imagePath) {
  const response = await api.delete(
    `/catalog/v2.0/merchants/${merchantId}/image/${encodeURIComponent(imagePath)}`
  );
  return response.data;
}

async function listarImagens(api, merchantId, page = 1, limit = 10) {
  const response = await api.get(`/catalog/v2.0/merchants/${merchantId}/images`, {
    params: { page, limit },
  });
  return response.data;
}

async function listarImagens(api, merchantId, page = 1, limit = 100) {
  const response = await api.get(
    `/catalog/v2.0/merchants/${merchantId}/images`,
    {
      params: { page, limit },
    }
  );
  return response.data;
}

module.exports = {
  listarCatalogos,
  verificarVersaoCatalogo,
  listarCategorias,
  criarCategoria,
  buscarCategoria,
  editarCategoria,
  listarItensDaCategoria,
  deletarCategoria,
  listarProdutos,
  criarProduto,
  editarProduto,
  deletarProduto,
  listarProdutosPorExternalCode,
  buscarProduto,
  deletarItem,
  buscarItemFlat,
  criarOuAtualizarItem,
  editarPrecoItem,
  editarStatusItem,
  editarExternalCodeItem,
  listarGruposOpcao,
  atualizarGrupoOpcao,
  deletarGrupoOpcao,
  desassociarGrupoOpcaoProduto,
  atualizarStatusGrupoOpcao,
  deletarOpcao,
  atualizarPrecoOpcao,
  atualizarExternalCodeOpcao,
  atualizarStatusOpcao,
  uploadImagem,
  deletarImagem,
  listarImagens,
};