const uai = require("./services/uairango.service");

async function main() {
  try {
    const merchantId = process.env.UAIRANGO_MERCHANT_ID;
    const api = await uai.getApi();

    const result = await uai.listarImagens(api, merchantId, 1, 100);

    console.log("LISTA DE IMAGENS:");
    console.log(JSON.stringify(result, null, 2));

    if (Array.isArray(result)) {
      console.log("Total:", result.length);
    } else if (Array.isArray(result?.images)) {
      console.log("Total:", result.images.length);
    }
  } catch (error) {
    console.log("ERRO AO LISTAR IMAGENS:");
    console.log(error.response?.data || error.message);
  }
}

main();