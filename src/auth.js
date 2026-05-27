const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

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

module.exports = { gerarToken };