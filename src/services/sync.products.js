const axios = require("axios");
const sharp = require("sharp");
const li = require("./lojaintegrada.service");
const uai = require("./uairango.service");
const store = require('./order-store.service');
const {
  normalizarNomeCategoria,
  liProdutoParaUaiRangoProduct,
  liProdutoParaUaiRangoItem,
  getLiProductExternalCode,
} = require("./mapper");

async function garantirCategoriaUai(api, merchantId, catalogId, nomeCategoria) {
  const categorias = await uai.listarCategorias(api, merchantId, catalogId, true);

  const existente = (categorias || []).find(
    (c) => (c.name || "").trim().toLowerCase() === nomeCategoria.trim().toLowerCase()
  );

  if (existente) return existente;

  return await uai.criarCategoria(api, merchantId, catalogId, {
    name: nomeCategoria,
    externalCode: nomeCategoria,
    status: "AVAILABLE",
    template: "DEFAULT",
  });
}

async function buscarEstoquePorProdutoId(produtoId) {
  try {
    return await li.buscarEstoque(produtoId);
  } catch {
    return null;
  }
}

async function buscarPrecoPorProdutoId(produtoId) {
  try {
    return await li.buscarPreco(produtoId);
  } catch {
    return null;
  }
}

async function buscarNomeCategoriaProduto(produto) {
  try {
    const categoriaUri = produto?.categorias?.[0];
    if (!categoriaUri) return null;

    const categoriaId = String(categoriaUri).split("/").filter(Boolean).pop();
    if (!categoriaId) return null;

    const categoria = await li.buscarCategoria(categoriaId);
    return categoria?.nome || null;
  } catch {
    return null;
  }
}


function nomeProdutoValido(produto) {
  return String(produto?.nome || produto?.name || '').trim();
}

function produtoTemVariacao(produto) {
  return Boolean(
    produto?.grade ||
    produto?.grade_1 ||
    produto?.grade_2 ||
    produto?.variacao ||
    produto?.variacao_1 ||
    produto?.variacao_2 ||
    produto?.produto_pai ||
    produto?.produto_pai_id ||
    produto?.parent ||
    produto?.parent_id ||
    produto?.filhos?.length ||
    produto?.variacoes?.length ||
    produto?.grades?.length
  );
}

async function buscarProdutoCompletoSeguro(produtoResumo) {
  try {
    const completo = await li.buscarProduto(produtoResumo.id, { descricao_completa: 1 });
    return { ...produtoResumo, ...completo };
  } catch (error) {
    console.log('⚠️  Não consegui buscar produto completo ' + produtoResumo.id + ':', error.response?.data || error.message);
    return produtoResumo;
  }
}

function unwrapObjects(data) {
  if (!data) return [];
  if (Array.isArray(data?.objects)) return data.objects;
  if (Array.isArray(data)) return data;
  return [];
}

async function buscarItemExistenteUai(api, merchantId, categoryId, produtoIdLojaIntegrada, produtoUaiRangoId = null) {
  const resposta = await uai.listarItensDaCategoria(api, merchantId, categoryId);
  const itens = unwrapObjects(resposta);

  return itens.find((item) => {
    return (
      String(item.externalCode || "") === String(produtoIdLojaIntegrada) ||
      String(item.productId || "") === String(produtoUaiRangoId || "") ||
      String(item.product?.id || "") === String(produtoUaiRangoId || "")
    );
  }) || null;
}

function guessMimeTypeFromUrl(url = "") {
  const cleanUrl = String(url).split("?")[0].toLowerCase();

  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function extrairUrlImagemLI(imagem) {
  if (!imagem) return null;

  const url =
    imagem.media ||
    imagem.pequena ||
    imagem.grande ||
    imagem.icone ||
    imagem.url ||
    imagem.src ||
    null;

  if (url && /^https?:\/\//i.test(url)) return url;

  if (imagem.caminho) {
    return `https://cdn.awsli.com.br/${String(imagem.caminho).replace(/^\/+/, "")}`;
  }

  return null;
}

function isUrlJpgOuPng(url = "") {
  const clean = String(url).split("?")[0].toLowerCase();
  return (
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".png")
  );
}

async function buscarPrimeiraImagemProduto(produto) {
  const imagens = Array.isArray(produto?.imagens) ? produto.imagens : [];
  const principal = produto?.imagem_principal ? [produto.imagem_principal] : [];
  const candidatas = [...principal, ...imagens]
    .map((img) => {
      const url = extrairUrlImagemLI(img);
      return url ? { ...img, url } : null;
    })
    .filter(Boolean);

  return candidatas.find((img) => isUrlJpgOuPng(img.url)) || candidatas[0] || null;
}

async function baixarImagemEmFormatos(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    console.log("Download da imagem OK, tamanho:", response.data.length);

    const inputBuffer = Buffer.from(response.data);

    const baseImage = sharp(inputBuffer)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(512, 512, {
        fit: "contain",
        background: "#ffffff",
      });

    const jpegBuffer = await baseImage
      .clone()
      .removeAlpha()
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log("Processamento OK, jpeg size:", jpegBuffer.length);

    const jpegMeta = await sharp(jpegBuffer).metadata();

    console.log("JPEG final:", {
      width: jpegMeta.width,
      height: jpegMeta.height,
      format: jpegMeta.format,
      sizeBytes: jpegBuffer.length,
    });

    const jpegBase64 = jpegBuffer.toString("base64").replace(/\s+/g, "");
    const jpegDataUri = `data:image/jpeg;base64,${jpegBase64}`;

    return {
      jpegBase64,
      jpegDataUri: jpegDataUri,
    };
  } catch (error) {
    console.log("Erro ao baixar/processar imagem:", error.message);
    throw error;
  }
}

async function subirImagemProdutoUai(api, merchantId, produto) {
  try {
    const imagemLI = await buscarPrimeiraImagemProduto(produto);
    if (!imagemLI?.url) return null;

    console.log("URL escolhida:", imagemLI.url);

    const formatos = await baixarImagemEmFormatos(imagemLI.url);

    const tentativas = [
      { nome: "png dataUri", image: formatos.pngDataUri },
      { nome: "jpeg dataUri", image: formatos.jpegDataUri },
    ];

    for (const tentativa of tentativas) {
      try {
        console.log(`Tentando upload (${tentativa.nome})...`);
        console.log("Prévia:", tentativa.image.slice(0, 80));

        const uploadResp = await uai.uploadImagem(api, merchantId, tentativa.image);

        console.log(`UPLOAD OK (${tentativa.nome}):`);
        console.log(JSON.stringify(uploadResp, null, 2));

        return (
          uploadResp?.imagePath ||
          uploadResp?.path ||
          uploadResp?.image?.path ||
          null
        );
      } catch (error) {
        console.log(`Falhou (${tentativa.nome}):`);
        console.log(error.response?.status);
        console.log(JSON.stringify(error.response?.data, null, 2));
      }
    }

    return null;
  } catch (error) {
    console.log(
      `Falha ao subir imagem do produto ${produto.id}:`,
      error.response?.data || error.message
    );
    return null;
  }
}

async function garantirProdutoUai(api, merchantId, produto) {
  const nome = nomeProdutoValido(produto);
  if (!nome) {
    const err = new Error('Produto ' + (produto?.id || '') + ' ignorado: nome vazio na Loja Integrada.');
    err.skipProduct = true;
    throw err;
  }

  if (produtoTemVariacao(produto)) {
    const err = new Error('Produto ' + (produto?.id || '') + ' ignorado: produto com variação/grade na Loja Integrada.');
    err.skipProduct = true;
    throw err;
  }

  const externalCode = getLiProductExternalCode(produto);
  const oldExternalCode = String(produto.id);

  const codigosBusca = [...new Set([externalCode, oldExternalCode].filter(Boolean))];

  for (const codigoBusca of codigosBusca) {
    try {
      const existentes = await uai.listarProdutosPorExternalCode(
        api,
        merchantId,
        codigoBusca
      );

      if (Array.isArray(existentes) && existentes.length > 0) {
        const existente = existentes[0];

        const payloadEdicao = {
          ...liProdutoParaUaiRangoProduct(produto, {
            id: existente.id,
          }),
          id: existente.id,
        };

        // Migra produtos antigos criados com externalCode = ID interno da LI
        // para externalCode = SKU/id_externo, sem duplicar produto na UaiRango.
        const atualizado = await uai.editarProduto(
          api,
          merchantId,
          existente.id,
          payloadEdicao
        );

        return atualizado;
      }
    } catch (error) {
      console.log(
        `Falha ao buscar produto por externalCode ${codigoBusca}, tentando próxima opção/criação:`,
        error.response?.data || error.message
      );
    }
  }

  const payloadCriacao = liProdutoParaUaiRangoProduct(produto);

  return await uai.criarProduto(api, merchantId, payloadCriacao);
}

async function vincularImagemAoProdutoUai(api, merchantId, produto, produtoUai) {
  try {
    const imagemLI = await buscarPrimeiraImagemProduto(produto);

    if (!imagemLI?.url) {
      console.log(`Produto ${produto.id} sem imagem`);
      return produtoUai;
    }

    console.log("Baixando imagem:", imagemLI.url);

    const formatos = await baixarImagemEmFormatos(imagemLI.url);

    const image = formatos.jpegDataUri;

    console.log("Tamanho da imagem base64:", image.length);

    // Primeiro, fazer upload da imagem
    const uploadResp = await uai.uploadImagem(api, merchantId, image);

    const imagePath =
      uploadResp?.imagePath ||
      uploadResp?.path ||
      uploadResp?.image?.path ||
      null;

    if (!imagePath) {
      console.log("Falha: uploadImagem não retornou imagePath");
      return produtoUai;
    }

    const payloadEdicao = {
      ...liProdutoParaUaiRangoProduct(produto, {
        id: produtoUai.id,
        imagePath,
      }),
      id: produtoUai.id,
    };

    console.log("PAYLOAD editarProduto com imagePath:");
    console.log(payloadEdicao.imagePath);

    const atualizado = await uai.editarProduto(
      api,
      merchantId,
      produtoUai.id,
      payloadEdicao
    );

    console.log("Produto atualizado com imagem");

    // reler o produto depois da edição
    const produtosRelidos = await uai.listarProdutosPorExternalCode(
      api,
      merchantId,
      getLiProductExternalCode(produto)
    );

    if (Array.isArray(produtosRelidos) && produtosRelidos.length > 0) {
      console.log("Produto relido após editar imagem:");
      console.log(JSON.stringify(produtosRelidos[0], null, 2));
      return produtosRelidos[0];
    }

    return atualizado;
  } catch (error) {
    console.log(
      `Falha ao enviar imagem no produto ${produto.id}:`,
      error.response?.data || error.message
    );
    return produtoUai;
  }
}

async function sincronizarProduto(produto, api, merchantId, catalogId) {
  const nomeCategoriaLojaIntegrada = await buscarNomeCategoriaProduto(produto);

  const nomeCategoria =
    normalizarNomeCategoria(nomeCategoriaLojaIntegrada) || "Geral";

  const categoriaUai = await garantirCategoriaUai(
    api,
    merchantId,
    catalogId,
    nomeCategoria
  );

  const estoque = await buscarEstoquePorProdutoId(produto.id);
  const precoInfo = await buscarPrecoPorProdutoId(produto.id);

  // 1) primeiro garante/cria o produto
  let produtoUai = await garantirProdutoUai(api, merchantId, produto);

  // 2) verifica se já existe item nessa categoria para não duplicar
  const itemExistente = await buscarItemExistenteUai(
    api,
    merchantId,
    categoriaUai.id,
    getLiProductExternalCode(produto),
    produtoUai.id
  );

  // 3) cria/atualiza item
  const itemPayload = liProdutoParaUaiRangoItem({
    produto: {
      ...produto,
      itemUaiRangoId: itemExistente?.id,
      preco_venda: Number(
        precoInfo?.promocional ??
        precoInfo?.cheio ??
        precoInfo?.preco ??
        0
      ),
    },
    produtoUaiRangoId: produtoUai.id,
    categoryId: categoriaUai.id,
    estoque,
  });

  const itemCompletoPayload = {
    item: itemPayload,
    products: [
      {
        ...produtoUai,
        optionGroups: produtoUai.optionGroups || [],
      },
    ],
    optionGroups: [],
    options: [],
  };

  const itemCriadoOuAtualizado = await uai.criarOuAtualizarItem(
    api,
    merchantId,
    itemCompletoPayload
  );

  // 4) imagem fica controlada por ENV, porque o sandbox pode falhar nessa rota
  if (String(process.env.UAIRANGO_SYNC_IMAGES || "false") === "true") {
    produtoUai = await vincularImagemAoProdutoUai(
      api,
      merchantId,
      produto,
      produtoUai
    );
  }

  return {
    categoriaOriginal: nomeCategoriaLojaIntegrada,
    categoriaEscolhida: nomeCategoria,
    precoOriginal: precoInfo,
    categoria: categoriaUai,
    produto: produtoUai,
    item: itemCriadoOuAtualizado,
    itemPayload,
  };
}

async function sincronizarTodosProdutos() {
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;
  const catalogId = process.env.UAIRANGO_CATALOG_ID;
  const api = await uai.getApi();

  let offset = 0;
  const limit = 20;
  const resultados = [];

  while (true) {
    const pagina = await li.listarProdutos({
      limit,
      offset,
      ativo: true,
      descricao_completa: 1,
    });

    const objetos = pagina?.objects || [];
    if (!objetos.length) break;

    for (const produtoResumo of objetos) {
      let produto = produtoResumo;

      try {
        produto = await buscarProdutoCompletoSeguro(produtoResumo);
        const nome = nomeProdutoValido(produto);

        if (!nome) {
          const motivo = 'Produto ignorado: nome vazio na Loja Integrada';
          console.log('⏭️ ' + motivo + ' | ID ' + produtoResumo.id);

          store.upsertProduct(produtoResumo.id, {
            name: null,
            status: 'ignored',
            ok: false,
            ignored: true,
            reason: motivo,
            externalCode: String(produtoResumo.id_externo || produtoResumo.sku || produtoResumo.id),
          });

          resultados.push({
            produtoLojaIntegradaId: produtoResumo.id,
            nome: null,
            ok: false,
            ignored: true,
            motivo,
          });
          continue;
        }

        if (produtoTemVariacao(produto)) {
          const motivo = 'Produto ignorado: possui variação/grade na Loja Integrada';
          console.log('⏭️ ' + motivo + ' | ID ' + produtoResumo.id + ' | ' + nome);

          store.upsertProduct(produtoResumo.id, {
            name: nome,
            status: 'ignored',
            ok: false,
            ignored: true,
            reason: motivo,
            externalCode: String(produtoResumo.id_externo || produtoResumo.sku || produtoResumo.id),
          });

          resultados.push({
            produtoLojaIntegradaId: produtoResumo.id,
            nome,
            ok: false,
            ignored: true,
            motivo,
          });
          continue;
        }

        const result = await sincronizarProduto(
          produto,
          api,
          merchantId,
          catalogId
        );

        store.upsertProduct(produto.id, {
          name: nome,
          status: 'sincronizado',
          ok: true,
          uaiProductId: result?.produto?.id || null,
          uaiItemId: result?.item?.item?.id || result?.item?.id || null,
          categoryName: result?.categoriaEscolhida || null,
          price: result?.item?.item?.price?.value
          ?? result?.item?.price?.value
          ?? result?.itemPayload?.price?.value
          ?? null,
          externalCode: getLiProductExternalCode(produto),
          result,
        });

        resultados.push({
          produtoLojaIntegradaId: produto.id,
          nome,
          ok: true,
          result,
        });
      } catch (error) {
        const nome = nomeProdutoValido(produto);
        const ignored = !!error.skipProduct;

        store.upsertProduct(produtoResumo.id, {
          name: nome || null,
          status: ignored ? 'ignored' : 'error',
          ok: false,
          ignored,
          error: error.response?.data || error.message,
          externalCode: String(produtoResumo.id_externo || produtoResumo.sku || produtoResumo.id),
        });

        resultados.push({
          produtoLojaIntegradaId: produtoResumo.id,
          nome: nome || null,
          ok: false,
          ignored,
          erro: error.response?.data || error.message,
        });
      }
    }

    if (!pagina?.meta?.next) break;
    offset += limit;
  }

  return resultados;
}

module.exports = {
  sincronizarProduto,
  sincronizarTodosProdutos,
};