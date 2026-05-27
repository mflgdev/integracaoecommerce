require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const li = require("../services/lojaintegrada.service");
const uai = require("../services/uairango.service");
const { sincronizarProduto } = require("../services/sync.products");
const store = require("../services/order-store.service");

const STATE_FILE = path.resolve(__dirname, "../../products-sync-state.json");

const INTERVALO_WORKER_MS = Number(process.env.PRODUCTS_WORKER_INTERVAL_MS || 300000); // 5 minutos
const LIMIT = Number(process.env.PRODUCTS_WORKER_LIMIT || 20);
const DELAY_LI_MS = Number(process.env.PRODUCTS_WORKER_LI_DELAY_MS || 750); // seguro para 100/min da LI
const DELAY_ENTRE_SINCS_MS = Number(process.env.PRODUCTS_WORKER_SYNC_DELAY_MS || 3500);
const DELAY_429_MS = Number(process.env.PRODUCTS_WORKER_429_DELAY_MS || 65000);
const ONLY_ACTIVE = String(process.env.PRODUCTS_WORKER_ONLY_ACTIVE || "false") === "true";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function carregarState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      criadoEm: new Date().toISOString(),
      produtos: {},
    };
  }

  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function salvarState(state) {
  state.atualizadoEm = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function erroEh429(error) {
  return Number(error.response?.status) === 429;
}

function erroApi(error) {
  return error.response?.data || error.message || error;
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
    produto?.variacoes?.length
  );
}

async function executarComRetry(nome, fn) {
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!erroEh429(error)) throw error;

      console.log(`⚠️  429 em ${nome}. Esperando ${DELAY_429_MS / 1000}s...`);
      console.log(JSON.stringify(erroApi(error), null, 2));
      await sleep(DELAY_429_MS);
    }
  }
}

async function chamadaLojaIntegrada(nome, fn) {
  const resultado = await executarComRetry(nome, fn);
  await sleep(DELAY_LI_MS);
  return resultado;
}

function gerarHashProduto({ produto, preco, estoque }) {
  const dadosImportantes = {
    produto: {
      id: produto?.id,
      sku: produto?.sku,
      nome: produto?.nome,
      descricao: produto?.descricao,
      descricao_completa: produto?.descricao_completa,
      ativo: produto?.ativo,
      categorias: produto?.categorias,
      marca: produto?.marca,
      peso: produto?.peso,
      altura: produto?.altura,
      largura: produto?.largura,
      profundidade: produto?.profundidade,
    },
    preco: {
      cheio: preco?.cheio,
      promocional: preco?.promocional,
      preco: preco?.preco,
      custo: preco?.custo,
    },
    estoque: {
      gerenciado: estoque?.gerenciado,
      quantidade: estoque?.quantidade,
      quantidade_disponivel: estoque?.quantidade_disponivel,
      situacao_em_estoque: estoque?.situacao_em_estoque,
      situacao_sem_estoque: estoque?.situacao_sem_estoque,
    },
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(dadosImportantes))
    .digest("hex");
}

async function buscarProdutosPagina(offset) {
  const params = {
    limit: LIMIT,
    offset,
    descricao_completa: 1,
  };

  if (ONLY_ACTIVE) params.ativo = true;

  return chamadaLojaIntegrada("listarProdutos", () => li.listarProdutos(params));
}

async function montarProdutoParaComparacao(produtoResumo) {
  const produtoId = produtoResumo.id;

  const produtoCompleto = await chamadaLojaIntegrada(`buscarProduto ${produtoId}`, () =>
    li.buscarProduto(produtoId, {
      descricao_completa: 1,
    })
  ).catch((error) => {
    console.log(`⚠️  Não consegui buscar produto completo ${produtoId}:`, JSON.stringify(erroApi(error), null, 2));
    return produtoResumo;
  });

  const produtoFinal = {
    ...produtoResumo,
    ...produtoCompleto,
  };

  const preco = await chamadaLojaIntegrada(`buscarPreco ${produtoId}`, () =>
    li.buscarPreco(produtoId)
  ).catch((error) => {
    console.log(`⚠️  Não consegui buscar preço do produto ${produtoId}:`, JSON.stringify(erroApi(error), null, 2));
    return null;
  });

  const estoque = await chamadaLojaIntegrada(`buscarEstoque ${produtoId}`, () =>
    li.buscarEstoque(produtoId)
  ).catch((error) => {
    console.log(`⚠️  Não consegui buscar estoque do produto ${produtoId}:`, JSON.stringify(erroApi(error), null, 2));
    return null;
  });

  return {
    produto: produtoFinal,
    preco,
    estoque,
    hash: gerarHashProduto({ produto: produtoFinal, preco, estoque }),
  };
}

async function rodarCiclo() {
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;
  const catalogId = process.env.UAIRANGO_CATALOG_ID;

  if (!merchantId) throw new Error("UAIRANGO_MERCHANT_ID não definido no .env");
  if (!catalogId) throw new Error("UAIRANGO_CATALOG_ID não definido no .env");

  const api = await uai.getApi();
  const state = carregarState();

  let offset = 0;
  let pagina = 1;
  let encontrados = 0;
  let novos = 0;
  let alterados = 0;
  let ignorados = 0;
  let erros = 0;

  console.log("");
  console.log("====================================");
  console.log("WORKER DE PRODUTOS - NOVO CICLO");
  console.log(new Date().toLocaleString("pt-BR"));
  console.log("====================================");

  while (true) {
    console.log(`📦 Buscando página ${pagina} | offset ${offset}`);

    const resposta = await buscarProdutosPagina(offset);
    const produtos = resposta?.objects || [];

    if (!produtos.length) break;

    encontrados += produtos.length;

    for (const produtoResumo of produtos) {
      const produtoId = String(produtoResumo.id);
      const registroAnterior = state.produtos[produtoId];

      try {
      const comparacao = await montarProdutoParaComparacao(produtoResumo);

      if (produtoTemVariacao(comparacao.produto)) {
        ignorados++;

        state.produtos[produtoId] = {
          ...(state.produtos[produtoId] || {}),
          id: produtoId,
          sku: produtoParaSincronizar.sku || null,
          nome: produtoParaSincronizar.nome,
          ignorado: true,
          motivoIgnorado: "Produto com variação/grade na Loja Integrada",
          ignoradoEm: new Date().toISOString(),
        };

        salvarState(state);

        console.log("");
        console.log("⏭️ Produto ignorado por ter variação/grade");
        console.log(`${produtoId} | ${comparacao.produto.sku || "sem SKU"} | ${comparacao.produto.nome || "sem nome"}`);

        continue;
      }

      const produtoNovo = !registroAnterior;
      const produtoAlterado = registroAnterior?.hash !== comparacao.hash;

        if (!produtoNovo && !produtoAlterado) {
          ignorados++;
          continue;
        }

        if (produtoNovo) novos++;
        if (produtoAlterado) alterados++;

        console.log("");
        console.log(produtoNovo ? "🆕 Produto novo detectado" : "✏️ Produto alterado detectado");
        console.log(`${produtoId} | ${comparacao.produto.sku || "sem SKU"} | ${comparacao.produto.nome}`);

        const produtoCompleto = await chamadaLojaIntegrada(`buscarProduto ${produtoId}`, () =>
          li.buscarProduto(produtoId, {
            descricao_completa: 1,
          })
        );

        const nomeProduto =
          produtoCompleto?.nome ||
          produtoResumo?.nome ||
          produtoResumo?.sku ||
          `Produto ${produtoId}`;

        if (!produtoCompleto?.nome && !produtoResumo?.nome) {
          console.log(`⚠️ Produto ${produtoId} veio sem nome na Loja Integrada. Usando fallback: ${nomeProduto}`);
        }

        const produtoParaSincronizar = {
          ...produtoResumo,
          ...produtoCompleto,
          nome: nomeProduto,
        };

        if (!produtoParaSincronizar.nome || !String(produtoParaSincronizar.nome).trim()) {
          ignorados++;

          state.produtos[produtoId] = {
            ...(state.produtos[produtoId] || {}),
            id: produtoId,
            sku: produtoParaSincronizar.sku || comparacao.produto.sku || null,
            nome: null,
            ignorado: true,
            motivoIgnorado: 'Produto sem nome na Loja Integrada',
            ignoradoEm: new Date().toISOString(),
          };

          salvarState(state);
          console.log(`⏭️ Produto ${produtoId} ignorado porque veio sem nome da Loja Integrada`);
          continue;
        }

        const resultado = await executarComRetry(`sincronizarProduto ${produtoId}`, () =>
          sincronizarProduto(produtoParaSincronizar, api, merchantId, catalogId)
        );

        store.upsertProduct(produtoId, {
          name: produtoParaSincronizar.nome,
          status: 'sincronizado',
          ok: true,
          uaiProductId: resultado?.produto?.id || null,
          uaiItemId: resultado?.item?.id || resultado?.item?.item?.id || null,
          categoryName: resultado?.categoriaEscolhida || null,
          externalCode: String(produtoId),
          result: resultado,
        });

        state.produtos[produtoId] = {
          id: produtoId,
          sku: produtoParaSincronizar.sku || null,
          nome: produtoParaSincronizar.nome,
          hash: comparacao.hash,
          ok: true,
          ultimaSincronizacao: new Date().toISOString(),
          produtoUaiRangoId: resultado?.produto?.id || null,
          itemUaiRangoId: resultado?.item?.id || resultado?.item?.item?.id || null,
          categoriaEscolhida: resultado?.categoriaEscolhida || null,
        };

        salvarState(state);
        console.log(`✅ Sincronizado: ${produtoParaSincronizar.nome}`);
        await sleep(DELAY_ENTRE_SINCS_MS);
      } catch (error) {
        erros++;

        store.upsertProduct(produtoId, {
          name: produtoResumo.nome || null,
          status: 'error',
          ok: false,
          error: erroApi(error),
          externalCode: String(produtoId),
        });

        state.produtos[produtoId] = {
          ...(state.produtos[produtoId] || {}),
          id: produtoId,
          sku: produtoResumo.sku || null,
          nome: produtoResumo.nome || produtoResumo.sku || 'Produto sem nome',
          ok: false,
          ultimoErro: erroApi(error),
          erroEm: new Date().toISOString(),
        };

        salvarState(state);

        console.log(`❌ Erro no produto ${produtoId} | ${produtoResumo.nome}`);
        console.log(JSON.stringify(erroApi(error), null, 2));
        await sleep(DELAY_ENTRE_SINCS_MS);
      }
    }

    if (!resposta?.meta?.next) break;

    offset += LIMIT;
    pagina++;
  }

  console.log("");
  console.log("Resumo do ciclo:");
  console.log("Encontrados:", encontrados);
  console.log("Novos:", novos);
  console.log("Alterados:", alterados);
  console.log("Ignorados:", ignorados);
  console.log("Erros:", erros);
}

async function iniciarWorker() {
  while (true) {
    try {
      await rodarCiclo();
    } catch (error) {
      console.log("❌ Erro geral no ciclo:");
      console.log(error.response?.data || error.message || error);
    }

    console.log(`⏳ Próximo ciclo em ${INTERVALO_WORKER_MS / 1000}s`);
    await sleep(INTERVALO_WORKER_MS);
  }
}

iniciarWorker();
