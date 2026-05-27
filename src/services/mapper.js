const crypto = require("crypto");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function truncate(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim();
}

function limparHTML(html) {
  if (!html) return "";

  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\|/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function calcularOverprice(valorBase) {
  const percent = toNumber(process.env.OVERPRICE_PERCENT, 0);
  const preco = toNumber(valorBase, 0);
  const finalValue = preco * (1 + percent / 100);
  return Number(finalValue.toFixed(2));
}

function statusItemFromEstoque(estoque) {
  const disableWhenOut =
    String(process.env.UAIRANGO_DISABLE_WHEN_OUT_OF_STOCK || "true") === "true";

  const gerenciado = !!estoque?.gerenciado;
  const qtd = toNumber(
    estoque?.quantidade_disponivel ?? estoque?.quantidade,
    0
  );

  if (!gerenciado) return "AVAILABLE";
  if (qtd > 0) return "AVAILABLE";
  return disableWhenOut ? "UNAVAILABLE" : "AVAILABLE";
}

const mapaCategorias = {
  "Alimentação": "Alimentação",
  "Alimento para Aves": "Alimentos para Aves",
  "Calopsita": "Alimentos para Aves",
  "Alimento para Peixes": "Alimentos para Peixes",
  "Peixes Betta": "Alimentos para Peixes",
  "Alimento para Répteis": "Alimentos para Répteis",
  "Alimento para Roedores": "Alimentos para Roedores",
  "Petiscos": "Petiscos",
  "Bifinhos": "Petiscos",
  "Cookies e Biscoitos": "Petiscos",
  "Cuidado Oral": "Petiscos",
  "Outros Petiscos": "Petiscos",
  "Petiscos Naturais": "Petiscos",
  "Ração a Granel": "Ração a Granel",
  "Ração Medicamentos": "Ração Medicamentosa",
  "Ração Medicamentosa": "Ração Medicamentosa",
  "Ração Seca": "Ração Seca",
  "Ração Úmida": "Ração Úmida",

  "Banho e Limpeza": "Banho e Limpeza",
  "Acessórios de Higiene": "Banho e Limpeza",
  "Colônias e Perfumes": "Banho e Limpeza",
  "Cortador de Unhas": "Banho e Limpeza",
  "Educadores Repelentes e Atrativos": "Banho e Limpeza",
  "Hidratantes": "Banho e Limpeza",
  "Higiene Bucal": "Banho e Limpeza",
  "Lenços Umedecidos": "Banho e Limpeza",
  "Shampoos e Condicionadores": "Banho e Limpeza",

  "Acessórios": "Acessórios",
  "Acessórios para Alimentos": "Acessórios",
  "Bebedouros e Comedouros": "Acessórios",
  "Mamadeiras": "Acessórios",
  "Acessórios para Pássaros": "Acessórios",
  "Acessórios para Roedores": "Acessórios",
  "Acessórios para Transporte": "Acessórios",
  "Bolsas e Mochilas": "Acessórios",
  "Caixas de Transporte": "Acessórios",
  "Adestramento": "Acessórios",
  "Brinquedos": "Acessórios",
  "Arranhadores": "Acessórios",
  "Bolinhas": "Acessórios",
  "Brinquedos de Vinil": "Acessórios",
  "Brinquedos Educativos": "Acessórios",
  "Halteres": "Acessórios",
  "Mordedores": "Acessórios",
  "Pelúcias": "Acessórios",
  "Poleiros": "Acessórios",
  "Camas, Colchonetes e Cobertores": "Acessórios",
  "Casas": "Acessórios",
  "Guias e Coleiras": "Acessórios",

  "Areias, Banheiros e Tapetes": "Areias, Banheiros e Tapetes",
  "Areias e Banheiros": "Areias, Banheiros e Tapetes",
  "Areias Higiênicas": "Areias, Banheiros e Tapetes",
  "Banheiros": "Areias, Banheiros e Tapetes",
  "Tapetes Higiênicos e Fraldas": "Areias, Banheiros e Tapetes",

  "Farmácia": "Farmácia Pet",
  "Analgésicos": "Farmácia Pet",
  "Antiácidos": "Farmácia Pet",
  "Antialérgicos": "Farmácia Pet",
  "Antibióticos": "Farmácia Pet",
  "Anticoncepcionais": "Farmácia Pet",
  "Antieméticos": "Farmácia Pet",
  "Anti-Inflamatórios": "Farmácia Pet",
  "Antipulgas e Carrapatos": "Farmácia Pet",
  "Antitóxicos": "Farmácia Pet",
  "Cicatrizantes": "Farmácia Pet",
  "Expectorantes": "Farmácia Pet",
  "Probióticos": "Farmácia Pet",
  "Sarnicidas e Ectoparasitas": "Farmácia Pet",
  "Shampoos Medicamentosos": "Farmácia Pet",
  "Suplementos e Vitaminas": "Farmácia Pet",
  "Tratamento para Orelhas": "Farmácia Pet",
  "Tratamento para Pele": "Farmácia Pet",
  "Vermífugos": "Farmácia Pet",

  "Casa e Aroma": "Casa e Aroma",
};

function normalizarNomeCategoria(cat) {
  if (!cat) return null;
  const nome = String(cat?.nome || cat || "").replace(/\|/g, "").trim();
  return mapaCategorias[nome] || nome;
}

function extrairDescricaoProduto(produto) {
  const texto = limparHTML(
    produto?.descricao_completa ||
      produto?.descricao ||
      produto?.nome ||
      ""
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[^a-zA-Z0-9\s.,;:!?()\-\/]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return truncate(texto, 0);
}

function produtoTemVariacao(produto = {}) {
  return (
    produto.tipo === "atributo" ||
    produto.tipo === "atributo_opcao" ||
    (Array.isArray(produto.variacoes) && produto.variacoes.length > 0) ||
    (Array.isArray(produto.grades) && produto.grades.length > 0) ||
    (Array.isArray(produto.filhos) && produto.filhos.length > 0)
  );
}

function getLiProductExternalCode(produto = {}) {
  const sku = String(produto.sku || "").trim();

  if (!sku) {
    throw new Error(
      `Produto ${produto?.id || ""} sem SKU. Sincronização bloqueada.`
    );
  }

  return sku;
}

function liProdutoParaUaiRangoProduct(produto, extras = {}) {
  if (produtoTemVariacao(produto)) {
    throw new Error(
      `Produto ${produto?.id || ""} ignorado por possuir variação/grade/filhos.`
    );
  }

  const nome = truncate(produto?.nome, 140);

  if (!nome) {
    throw new Error(
      `Produto ${produto?.id || ""} sem nome. Sincronização bloqueada.`
    );
  }

  const payload = {
    id: extras.id,
    name: nome,
    description: extrairDescricaoProduto(produto),
    externalCode: getLiProductExternalCode(produto),
    status: produto.ativo ? "AVAILABLE" : "UNAVAILABLE",
    optionGroups: [],
  };

  if (extras.imagePath) payload.imagePath = extras.imagePath;
  if (extras.image) payload.image = extras.image;

  return payload;
}

function gerarUuidItemPorProduto(produtoId) {
  const hash = crypto
    .createHash("sha256")
    .update(`uairango-item-produto-${produtoId}`)
    .digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "4" + hash.substring(13, 16),
    "8" + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join("-");
}

function liProdutoParaUaiRangoItem({
  produto,
  produtoUaiRangoId,
  categoryId,
  estoque,
}) {
  if (produtoTemVariacao(produto)) {
    throw new Error(
      `Produto ${produto?.id || ""} ignorado por possuir variação/grade/filhos.`
    );
  }

  const nome = truncate(produto?.nome, 140);

  if (!nome) {
    throw new Error(
      `Produto ${produto?.id || ""} sem nome. Sincronização bloqueada.`
    );
  }

  const precoBase =
    produto.preco_promocional ??
    produto.preco_venda ??
    produto.preco_cheio ??
    produto.preco ??
    0;

  const precoFinal = calcularOverprice(precoBase);
  const status = produto.ativo ? statusItemFromEstoque(estoque) : "UNAVAILABLE";

  return {
    id: produto.itemUaiRangoId || gerarUuidItemPorProduto(produto.id),
    categoryId,
    productId: produtoUaiRangoId,
    type: "DEFAULT",
    name: nome,
    description: extrairDescricaoProduto(produto) || truncate(produto?.nome, 500),
    externalCode: getLiProductExternalCode(produto),
    status,
    price: {
      value: precoFinal,
      originalValue: precoFinal,
    },
    shifts: [
      {
        startTime: "00:00",
        endTime: "23:59",
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      },
    ],
  };
}

module.exports = {
  getLiProductExternalCode,
  produtoTemVariacao,
  calcularOverprice,
  statusItemFromEstoque,
  normalizarNomeCategoria,
  liProdutoParaUaiRangoProduct,
  liProdutoParaUaiRangoItem,
};