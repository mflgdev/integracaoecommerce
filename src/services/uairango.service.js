const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { gerarToken } = require("../auth.js");
const { criarClient } = require("../client.js");
const catalog = require("../catalog.js");
const merchants = require("../merchants.js");
const orders = require("../orders.js");
const events = require("../events.js");

async function getApi() {
  const token = await gerarToken();
  return criarClient(token);
}

async function uploadImagem(api, merchantId, image) {
  const payload = { image };

  console.log("Tentando upload com payload:", Object.keys(payload));
  console.log("image tipo:", typeof image);
  console.log("image início:", String(image).slice(0, 150));

  try {
    const response = await api.post(
      `/merchants/${merchantId}/images`,
      payload
    );

    return response.data;
  } catch (error) {
    console.log("Falha no upload:");
    console.log("status:", error.response?.status);
    console.log("body:", JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

module.exports = {
  getApi,
  ...catalog,
  ...merchants,
  ...orders,
  ...events,
};