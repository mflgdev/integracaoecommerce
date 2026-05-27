const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const axios = require("axios");

function criarClient(token) {
  return axios.create({
    baseURL: process.env.UAIRANGO_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "x-env": process.env.UAIRANGO_ENV || "development",
    },
    timeout: 30000,
  });
}

module.exports = { criarClient };