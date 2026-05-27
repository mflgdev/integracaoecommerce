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
        Accept: "application/json",
        "x-env": process.env.UAIRANGO_ENV || "development",
      },
    }
  );

  return response.data.accessToken;
}

async function getMerchantById(token, merchantId) {
  const response = await axios.get(
    `${process.env.UAIRANGO_BASE_URL}/merchant/v1.0/merchants/${merchantId}`,
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
    const merchantId = "COLE_AQUI_O_MERCHANT_ID";
    const token = await gerarToken();
    const merchant = await getMerchantById(token, merchantId);

    console.log("MERCHANT:");
    console.log(JSON.stringify(merchant, null, 2));
  } catch (error) {
    console.error("Erro ao buscar merchant:");
    console.error("STATUS:", error.response?.status);
    console.error("BODY:", error.response?.data || error.message);
  }
}

main();