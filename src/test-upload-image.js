const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
require("dotenv").config();

const { gerarToken } = require("./auth");

async function main() {
  const merchantId = process.env.UAIRANGO_MERCHANT_ID;
  const baseUrl = process.env.UAIRANGO_BASE_URL;
  const xEnv = process.env.UAIRANGO_ENV;

  const token = await gerarToken();

  const input = fs.readFileSync(path.join(__dirname, "teste.jpg"));

  const jpegBuffer = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(512, 512, {
      fit: "contain",
      background: "#ffffff",
    })
    .removeAlpha()
    .jpeg({
      quality: 85,
      progressive: false,
      mozjpeg: false,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();

  const meta = await sharp(jpegBuffer).metadata();

  console.log("JPEG local final:", {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    sizeBytes: jpegBuffer.length,
  });

  const image = `data:image/jpeg;base64,${jpegBuffer.toString("base64").replace(/\s+/g, "")}`;
  const payload = { image };
  const json = JSON.stringify(payload);

  const response = await axios({
    method: "post",
    url: `${baseUrl}/catalog/v2.0/merchants/${merchantId}/image/upload`,
    data: json,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-env": xEnv,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(json),
    },
    transformRequest: [(data) => data],
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });

  console.log("status:", response.status);
  console.log("data:", JSON.stringify(response.data, null, 2));
}

main().catch((err) => {
  console.log("FALHOU GERAL");
  console.log("message:", err.message);
  console.log("code:", err.code);
  console.log("status:", err.response?.status);
  console.log("data:", JSON.stringify(err.response?.data, null, 2));
});