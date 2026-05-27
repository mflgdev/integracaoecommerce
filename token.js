require("dotenv").config();
const axios = require("axios");

async function gerarToken() {
  try {
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

    console.log("STATUS:", response.status);
    console.log("BODY:");
    console.log(response.data);
  } catch (error) {
    console.error("Erro ao gerar token:");
    console.error("STATUS:", error.response?.status);
    console.error("BODY:", error.response?.data || error.message);
  }
}

gerarToken();