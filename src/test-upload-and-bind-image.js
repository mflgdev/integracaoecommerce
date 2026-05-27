const sharp = require("sharp");
require("dotenv").config();

const uai = require("./services/uairango.service");

async function gerarImagemBase64() {
  const jpegBuffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 0, g: 255, b: 0 }, // verde
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}

async function main() {
  try {
    const merchantId = process.env.UAIRANGO_MERCHANT_ID;
    const api = await uai.getApi();
    const externalCode = "352635390";
    const produtos = await uai.listarProdutosPorExternalCode(
      api,
      merchantId,
      externalCode
    );

    const produto = produtos?.[0];

    if (!produto) {
      throw new Error(`Produto ${externalCode} não encontrado`);
    }

    const image = await gerarImagemBase64();

    console.log("Enviando para uploadImagem...");
    const uploadResp = await uai.uploadImagem(api, merchantId, image);

    console.log("RESPOSTA uploadImagem:");
    console.log(JSON.stringify(uploadResp, null, 2));

    const imagePath =
      uploadResp?.imagePath ||
      uploadResp?.path ||
      uploadResp?.image?.path ||
      null;

    if (!imagePath) {
      throw new Error("uploadImagem não retornou imagePath");
    }

    const payloadEdicao = {
      id: produto.id,
      name: produto.name,
      description: produto.description || "",
      externalCode: String(produto.externalCode),
      status: produto.status || "AVAILABLE",
      optionGroups: produto.optionGroups || [],
      imagePath,
    };

    console.log("PAYLOAD editarProduto com imagePath:");
    console.log(JSON.stringify(payloadEdicao, null, 2));

    const atualizado = await uai.editarProduto(
      api,
      merchantId,
      produto.id,
      payloadEdicao
    );

    console.log("RESPOSTA editarProduto:");
    console.log(JSON.stringify(atualizado, null, 2));

    const relidos = await uai.listarProdutosPorExternalCode(
      api,
      merchantId,
      externalCode
    );

    console.log("PRODUTO RELIDO:");
    console.log(JSON.stringify(relidos?.[0] || null, null, 2));
  } catch (error) {
    console.log("ERRO NO TESTE:");
    console.log(JSON.stringify(error.response?.data || error.message, null, 2));
  }
}

main();