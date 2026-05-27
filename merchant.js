require("dotenv").config();
const axios = require("axios");

async function gerarToken() {
  const body = new URLSearchParams({
    grantType: "client_credentials",
    clientId: process.env.UAIRANGO_CLIENT_ID,
    clientSecret: process.env.UAIRANGO_CLIENT_SECRET,
  });

  const response = await axios.post(
    `${process.env.UAIRANGO_BASE_URL}/authentication/v1.0/oauth/token`,
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "x-env": process.env.UAIRANGO_ENV || "development",
      },
    }
  );

  return response.data.accessToken;
}

async function listarMerchants(token) {
  const response = await axios.get(
    `${process.env.UAIRANGO_BASE_URL}/merchant/v1.0/merchants`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "x-env": process.env.UAIRANGO_ENV || "development",
      },
    }
  );

  return response.data;
}

async function main() {
  try {
    const token = await gerarToken();
    const merchants = await listarMerchants(token);

    console.log("MERCHANTS:");
    console.log(JSON.stringify(merchants, null, 2));
  } catch (error) {
    console.error("Erro ao listar merchants:");
    console.error("STATUS:", error.response?.status);
    console.error("BODY:", error.response?.data || error.message);
  }
}

main();