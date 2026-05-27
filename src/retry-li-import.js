const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { retryLiImport } = require('./services/sync.orders');

async function main() {
  const orderId = process.argv[2];
  if (!orderId) throw new Error('Uso: npm run orders:retry-li -- <orderIdUaiRango>');
  console.log(JSON.stringify(await retryLiImport(orderId), null, 2));
}
main().catch((error) => { console.error(JSON.stringify(error.response?.data || error.message, null, 2)); process.exit(1); });
