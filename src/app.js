const express = require('express');
const bodyParser = require('body-parser');
const { sincronizarTodosProdutos } = require('./services/sync.products');
const { sincronizarTodosEstoques } = require('./services/sync.stock');
const ordersSync = require('./services/sync.orders');
const store = require('./services/order-store.service');
const uai = require('./services/uairango.service');

const app = express();
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));

function errorResponse(res, message, error) {
  res.status(500).json({ message, details: error.response?.data || error.message });
}

function page(title, body) {
  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

<style>
body {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  margin: 0;
  padding: 20px;
  background: #f1f3f6;
  color: #1c1c1c;
}

/* TITULO */
h1 {
  font-size: 20px;
  margin-bottom: 16px;
}

/* CARD */
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}

/* TABELA */
table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e5e7eb;
}

/* CABEÇALHO */
th {
  text-align: left;
  font-size: 12px;
  color: #6b7280;
  padding: 10px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
}

/* LINHAS */
td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

/* HOVER */
tr:hover {
  background: #f9fafb;
}

/* CODE */
code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* BOTÃO (SEM GRADIENTE!) */
.btn {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 6px;
  background: #111827;
  color: #fff;
  text-decoration: none;
  font-size: 12px;
}

/* STATUS */
.status {
  padding: 3px 8px;
  border-radius: 6px;
  background: #e5e7eb;
  color: #374151;
  font-size: 11px;
}

/* TEXTO FRACO */
.muted {
  color: #6b7280;
}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

app.get('/health', (req, res) => res.json({ ok: true, stats: store.dashboardStats() }));
app.get('/', (req, res) => res.redirect('/hub/orders'));

app.get('/hub/orders', (req, res) => {
  const orders = store.listOrders({ limit: Number(req.query.limit || 100), status: req.query.status, q: req.query.q });
  const stats = store.dashboardStats();

  const rows = orders.map((o) => `
<tr>
<td><a href="/hub/orders/${encodeURIComponent(o.orderId)}">${o.hubNumber || '-'}</a></td>
<td><code>${o.reference || o.orderId}</code></td>
<td>${o.customerName || '-'}</td>
<td><span class="status">${o.status || '-'}</span></td>
<td>R$ ${Number(o.total || 0).toFixed(2)}</td>
<td>${o.updatedAt || '-'}</td>
</tr>`).join('');

  res.send(page('Hub de pedidos', `
<h1>Hub de pedidos UaiRango</h1>

<div class="card">
<b>Total:</b> ${stats.totalOrders} pedidos |
<b>Eventos:</b> ${stats.totalEvents}<br>
<span class="muted">DB: ${stats.dbFile}</span>
</div>

<div class="card">
<a class="btn" href="/api/orders">API pedidos</a>
<a class="btn" href="/hub/products">Produtos</a>
<a class="btn" href="/hub/homologacao">Homologação</a>
<a class="btn" href="/health">Health</a>
</div>

<table>
<thead>
<tr>
<th>Hub</th>
<th>Ref</th>
<th>Cliente</th>
<th>Status</th>
<th>Total</th>
<th>Atualizado</th>
</tr>
</thead>
<tbody>
${rows || '<tr><td colspan="6">Nenhum pedido salvo ainda.</td></tr>'}
</tbody>
</table>
`));
});

app.get('/hub/orders/:orderId', (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) return res.status(404).send(page('Pedido não encontrado', '<h1>Pedido não encontrado</h1>'));

  const actions = `
<form style="display:inline" method="post" action="/api/orders/${encodeURIComponent(order.orderId)}/confirm"><button>Confirmar</button></form>
<form style="display:inline" method="post" action="/api/orders/${encodeURIComponent(order.orderId)}/ready"><button>Pronto retirada</button></form>
<form style="display:inline" method="post" action="/api/orders/${encodeURIComponent(order.orderId)}/dispatch"><button>Despachar</button></form>
<form style="display:inline" method="post" action="/api/orders/${encodeURIComponent(order.orderId)}/cancel"><button>Cancelar</button></form>`;

  const pagamentos = (order.summary?.payments || []).map((p) => `<li><b>${p.name || p.method || 'Pagamento'}</b> - R$ ${Number(p.value || 0).toFixed(2)}${p.brand ? ` | bandeira: ${p.brand}` : ''}${p.changeFor ? ` | troco para: R$ ${Number(p.changeFor).toFixed(2)}` : ''}</li>`).join('');
  const desconto = Number(order.summary?.discount || 0);

  res.send(page(`Pedido ${order.hubNumber}`, `
<h1>${order.hubNumber || order.orderId}</h1>

<div class="card">
${actions}
<p>
<b>Status:</b> ${order.status || '-'}<br>
<b>Cliente:</b> ${order.customerName || '-'}<br>
<b>Total:</b> R$ ${Number(order.total || 0).toFixed(2)}<br>
<b>Tipo:</b> ${order.summary?.operation || '-'}<br>
<b>Desconto/cupom:</b> ${desconto ? `R$ ${desconto.toFixed(2)}` : '-'}
</p>
<h2>Pagamento</h2>
<ul>${pagamentos || '<li>Nenhum pagamento salvo no resumo.</li>'}</ul>
</div>

<div class="card">
<h2>Resumo</h2>
<pre>${JSON.stringify(order.summary || {}, null, 2)}</pre>
</div>

<div class="card">
<h2>Payload LI</h2>
<pre>${JSON.stringify(order.liPayload || {}, null, 2)}</pre>
</div>

<div class="card">
<h2>Logs</h2>
<pre>${JSON.stringify(order.logs || [], null, 2)}</pre>
</div>
`));
});

function formatPriceBR(value) {
  const n = Number(
    typeof value === 'object'
      ? value?.value
      : String(value ?? '0').replace(',', '.')
  );

  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00';
}


function defaultMerchantId(req) {
  return req.params.merchantId || req.body?.merchantId || req.query?.merchantId || process.env.UAIRANGO_MERCHANT_ID;
}
function defaultCatalogId(req) {
  return req.params.catalogId || req.body?.catalogId || req.query?.catalogId || process.env.UAIRANGO_CATALOG_ID;
}
async function runUai(res, label, fn) {
  const startedAt = new Date().toISOString();
  try {
    const api = await uai.getApi();
    const data = await fn(api);
    res.json({ ok: true, label, startedAt, finishedAt: new Date().toISOString(), data });
  } catch (e) {
    errorResponse(res, `Erro em ${label}`, e);
  }
}
function sampleCategoryPayload(req) {
  return Object.keys(req.body || {}).length ? req.body : {
    name: `Categoria Homologacao ${Date.now()}`,
    externalCode: `homologacao-categoria-${Date.now()}`,
    status: 'AVAILABLE',
    template: 'DEFAULT'
  };
}
function sampleItemPayload(req) {
  if (Object.keys(req.body || {}).length) return req.body;
  const id = `homologacao-item-${Date.now()}`;
  return {
    item: {
      id,
      categoryId: req.query.categoryId || req.body?.categoryId || 'INFORME_CATEGORY_ID',
      productId: req.query.productId || req.body?.productId || 'INFORME_PRODUCT_ID',
      type: 'DEFAULT',
      name: 'Item Homologacao',
      description: 'Item de teste criado pelo hub para homologacao',
      externalCode: id,
      status: 'AVAILABLE',
      price: { value: 1.99, originalValue: 1.99 },
      shifts: [{ startTime: '00:00', endTime: '23:59', monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }]
    },
    products: [{ id: req.query.productId || req.body?.productId || 'INFORME_PRODUCT_ID', name: 'Produto Homologacao', externalCode: id, status: 'AVAILABLE', optionGroups: [] }],
    optionGroups: [],
    options: []
  };
}
function homologacaoPage() {
  const merchantId = process.env.UAIRANGO_MERCHANT_ID || 'INFORME_MERCHANT_ID';
  const catalogId = process.env.UAIRANGO_CATALOG_ID || 'INFORME_CATALOG_ID';
  const now = Date.now();

  const templates = {
    pollAck: { method: 'POST', url: '/sync/orders/poll-uairango', payload: {} },
    orderGet: { method: 'GET', url: '/api/homologacao/orders/INFORME_ORDER_ID', payload: {} },
    orderConfirm: { method: 'POST', url: '/api/homologacao/orders/INFORME_ORDER_ID/confirm', payload: {} },
    orderReady: { method: 'POST', url: '/api/homologacao/orders/INFORME_ORDER_ID/ready', payload: {} },
    orderDispatch: { method: 'POST', url: '/api/homologacao/orders/INFORME_ORDER_ID/dispatch', payload: {} },
    orderCancellationReasons: { method: 'GET', url: '/api/homologacao/orders/INFORME_ORDER_ID/cancellationReasons', payload: {} },
    orderCancel: {
      method: 'POST',
      url: '/api/homologacao/orders/INFORME_ORDER_ID/cancel',
      payload: {
        reason: 'INFORME_REASON_CODE_RETORNADO_NA_ROTA_DE_MOTIVOS',
        cancellationCode: 'INFORME_REASON_CODE_RETORNADO_NA_ROTA_DE_MOTIVOS',
        message: 'Cancelamento solicitado para homologação'
      }
    },
    merchants: { method: 'GET', url: '/api/homologacao/merchants', payload: {} },
    merchantDetails: { method: 'GET', url: `/api/homologacao/merchants/${merchantId}`, payload: {} },
    merchantStatusGet: { method: 'GET', url: `/api/homologacao/merchants/${merchantId}/status`, payload: {} },
    merchantStatusUpdate: {
      method: 'PUT',
      url: `/api/homologacao/merchants/${merchantId}/status`,
      payload: {
        status: 'AVAILABLE',
        operations: [
          { name: 'DELIVERY', status: 'AVAILABLE', estimatedTime: 15 },
          { name: 'TAKEOUT', status: 'UNAVAILABLE', estimatedTime: 10 }
        ]
      }
    },
    catalogs: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}`, payload: {} },
    categories: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}/${catalogId}/categories`, payload: {} },
    createCategory: {
      method: 'POST',
      url: `/api/homologacao/catalogs/${merchantId}/${catalogId}/categories`,
      payload: { name: `Categoria Homologacao ${now}`, externalCode: `categoria-homologacao-${now}`, status: 'AVAILABLE', template: 'DEFAULT' }
    },
    editCategory: {
      method: 'PATCH',
      url: `/api/homologacao/catalogs/${merchantId}/${catalogId}/categories/INFORME_CATEGORY_ID`,
      payload: { name: `Categoria Homologacao Editada ${now}`, externalCode: `categoria-homologacao-${now}`, status: 'AVAILABLE', template: 'DEFAULT' }
    },
    listCategoryItems: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}/categories/INFORME_CATEGORY_ID/items`, payload: {} },
    products: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}/products`, payload: {} },
    createProduct: {
      method: 'POST',
      url: `/api/homologacao/catalogs/${merchantId}/products`,
      payload: {
        id: 'c7ccccbd-dc63-48d2-9b96-45793d5d091d',
        name: 'Produto de teste',
        description: 'Descrição',
        additionalInformation: 'Homologação',
        image: 'data:image/png;base64,imageBase64',
        imagePath: '0f557c2da3bcc036e836b952bf6e530f.png',
        externalCode: `produto-homologacao-${now}`,
        serving: 'SERVES_1',
        dietaryRestrictions: []
      }
    },
    editProduct: {
      method: 'PUT',
      url: `/api/homologacao/catalogs/${merchantId}/products/INFORME_PRODUCT_ID`,
      payload: {
        name: 'Produto de teste editado',
        description: 'Descrição editada',
        additionalInformation: 'Homologação - edição',
        image: 'data:image/png;base64,imageBase64',
        imagePath: '0f557c2da3bcc036e836b952bf6e530f.png',
        externalCode: 'INFORME_EXTERNAL_CODE_PRODUTO',
        serving: 'SERVES_1',
        dietaryRestrictions: []
      }
    },
    upsertItem: {
      method: 'PUT',
      url: `/api/homologacao/catalogs/${merchantId}/items`,
      payload: {
        item: {
          id: `item-homologacao-${now}`,
          categoryId: 'INFORME_CATEGORY_ID',
          productId: 'INFORME_PRODUCT_ID',
          type: 'DEFAULT',
          name: 'Item Homologacao Teste',
          description: 'Item criado/editado pelo hub de homologação',
          externalCode: `item-homologacao-${now}`,
          status: 'AVAILABLE',
          price: { value: 19.9, originalValue: 19.9 },
          shifts: [{ startTime: '00:00', endTime: '23:59', monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }]
        },
        products: [{ id: 'INFORME_PRODUCT_ID', name: 'Produto Homologacao Teste', externalCode: 'INFORME_EXTERNAL_CODE_PRODUTO', status: 'AVAILABLE', optionGroups: [] }],
        optionGroups: [],
        options: []
      }
    },
    itemPrice: { method: 'PATCH', url: `/api/homologacao/catalogs/${merchantId}/items/price`, payload: [{ externalCode: 'INFORME_EXTERNAL_CODE_ITEM', price: { value: 21.9, originalValue: 24.9 } }] },
    itemStatus: { method: 'PATCH', url: `/api/homologacao/catalogs/${merchantId}/items/status`, payload: [{ externalCode: 'INFORME_EXTERNAL_CODE_ITEM', status: 'UNAVAILABLE' }] },
    itemFlat: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}/items/INFORME_ITEM_ID/flat`, payload: {} },
    optionGroups: { method: 'GET', url: `/api/homologacao/catalogs/${merchantId}/option-groups`, payload: {} },
    optionPrice: { method: 'PATCH', url: `/api/homologacao/catalogs/${merchantId}/options/price`, payload: [{ externalCode: 'INFORME_EXTERNAL_CODE_COMPLEMENTO', price: { value: 3.5, originalValue: 3.5 } }] },
    optionStatus: { method: 'PATCH', url: `/api/homologacao/catalogs/${merchantId}/options/status`, payload: [{ externalCode: 'INFORME_EXTERNAL_CODE_COMPLEMENTO', status: 'UNAVAILABLE' }] }
  };

  const checklist = [
    ['Order', 'Polling pedidos + acknowledgment', 'pollAck'],
    ['Order', 'Consultar pedido recebido', 'orderGet'],
    ['Order', 'Confirmar pedido', 'orderConfirm'],
    ['Order', 'Pronto para retirada', 'orderReady'],
    ['Order', 'Despachar pedido', 'orderDispatch'],
    ['Order', 'Motivos de cancelamento', 'orderCancellationReasons'],
    ['Order', 'Cancelar pedido', 'orderCancel'],
    ['Merchant', 'Listar lojas', 'merchants'],
    ['Merchant', 'Detalhes loja', 'merchantDetails'],
    ['Merchant', 'Status loja', 'merchantStatusGet'],
    ['Merchant', 'Atualizar status loja', 'merchantStatusUpdate'],
    ['Catalog', 'Listar catálogos', 'catalogs'],
    ['Catalog', 'Listar categorias', 'categories'],
    ['Catalog', 'Criar categoria', 'createCategory'],
    ['Catalog', 'Editar categoria', 'editCategory'],
    ['Catalog', 'Listar produtos', 'products'],
    ['Catalog', 'Criar produto', 'createProduct'],
    ['Catalog', 'Editar produto', 'editProduct'],
    ['Catalog', 'Criar/editar item completo', 'upsertItem'],
    ['Catalog', 'Alterar preço item', 'itemPrice'],
    ['Catalog', 'Alterar status item', 'itemStatus'],
    ['Catalog', 'Listar grupos/complementos', 'optionGroups'],
    ['Catalog', 'Alterar preço complemento', 'optionPrice'],
    ['Catalog', 'Alterar status complemento', 'optionStatus']
  ];

  function button(action, label) {
    return `<button type="button" class="plain-btn" data-action="${action}">${label}</button>`;
  }

  const rows = checklist.map(([group, label, action], i) => {
    const t = templates[action];
    return `<tr><td>${i + 1}</td><td>${group}</td><td>${label}</td><td><code>${t.method}</code></td><td><code>${t.url}</code></td><td>${button(action, 'Usar')}</td></tr>`;
  }).join('');

  return page('Homologação UaiRango', `
<style>
body { background:#f5f5f5; color:#222; }
h1 { font-size:22px; margin:0 0 12px; }
h2 { font-size:16px; margin:0 0 10px; }
.clean-wrap { max-width:1180px; margin:0 auto; }
.clean-grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
@media (max-width: 900px) { .clean-grid { grid-template-columns:1fr; } }
.card { border-radius:6px; }
.group { margin-bottom:12px; }
.group-title { font-weight:600; font-size:13px; margin:0 0 6px; color:#444; }
.plain-btn, button.plain-btn { margin:3px 3px 3px 0; padding:7px 10px; border:1px solid #ccc; border-radius:4px; background:#fff; color:#222; cursor:pointer; font-size:13px; }
.plain-btn:hover { background:#f0f0f0; }
.primary-btn { background:#222; color:#fff; border-color:#222; }
input, textarea { width:100%; border:1px solid #ccc; border-radius:4px; padding:8px; box-sizing:border-box; font-family:Consolas, Monaco, monospace; font-size:13px; background:#fff; }
textarea { min-height:260px; }
pre { background:#f7f7f7; color:#222; border:1px solid #ddd; border-radius:4px; padding:12px; max-height:500px; overflow:auto; white-space:pre-wrap; word-break:break-word; }
.small-note { color:#666; font-size:13px; }
.field { margin-bottom:8px; }
.field label { display:block; font-size:12px; color:#555; margin-bottom:4px; }
</style>
<div class="clean-wrap">
  <h1>Homologação UaiRango</h1>

  <div class="card">
    <a class="btn" href="/hub/orders">Pedidos</a>
    <a class="btn" href="/hub/products">Produtos</a>
    <a class="btn" href="/api/homologacao/routes">Rotas JSON</a>
    <p class="small-note">Merchant: <code>${merchantId}</code> &nbsp; Catálogo: <code>${catalogId}</code></p>
  </div>

  <div class="clean-grid">
    <div class="card">
      <h2>Etapas</h2>
      <div class="group"><div class="group-title">Order</div>
        ${button('pollAck', 'Polling + ack')}
        ${button('orderGet', 'Consultar pedido')}
        ${button('orderConfirm', 'Confirmar')}
        ${button('orderReady', 'Pronto retirada')}
        ${button('orderDispatch', 'Despachar')}
        ${button('orderCancellationReasons', 'Motivos cancelamento')}
        ${button('orderCancel', 'Cancelar')}
      </div>
      <div class="group"><div class="group-title">Merchant</div>
        ${button('merchants', 'Listar lojas')}
        ${button('merchantDetails', 'Detalhes loja')}
        ${button('merchantStatusGet', 'Status loja')}
        ${button('merchantStatusUpdate', 'Atualizar status')}
      </div>
      <div class="group"><div class="group-title">Catalog</div>
        ${button('catalogs', 'Listar catálogos')}
        ${button('categories', 'Listar categorias')}
        ${button('createCategory', 'Criar categoria')}
        ${button('editCategory', 'Editar categoria')}
        ${button('products', 'Listar produtos')}
        ${button('createProduct', 'Criar produto')}
        ${button('editProduct', 'Editar produto')}
        ${button('upsertItem', 'Criar/editar item')}
        ${button('itemPrice', 'Preço item')}
        ${button('itemStatus', 'Status item')}
        ${button('optionGroups', 'Grupos/complementos')}
        ${button('optionPrice', 'Preço complemento')}
        ${button('optionStatus', 'Status complemento')}
      </div>
      <p class="small-note">Ao clicar em uma etapa, o método, URL e JSON aparecem ao lado. Troque apenas os campos <code>INFORME_...</code>.</p>
    </div>

    <div class="card">
      <h2>Executar chamada</h2>
      <div class="field"><label>Método</label><input id="method" value="POST"></div>
      <div class="field"><label>URL</label><input id="url" value="/sync/orders/poll-uairango"></div>
      <div class="field"><label>JSON</label><textarea id="payload">{}</textarea></div>
      <button type="button" class="plain-btn primary-btn" id="run-action">Executar chamada selecionada</button>
    </div>
  </div>

  <div class="card"><h2>Resultado</h2><pre id="out">Clique em uma etapa.</pre></div>

  <div class="card">
    <h2>Rotas Conectadas</h2>
    <table><thead><tr><th>#</th><th>Grupo</th><th>Critério</th><th>Método</th><th>Rota</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
</div>

<script>
(function () {
  var templates = ${JSON.stringify(templates, null, 2)};

  function el(id) { return document.getElementById(id); }
  function pretty(obj) { return JSON.stringify(obj || {}, null, 2); }

  function prepareAction(name) {
    var t = templates[name];
    if (!t) {
      el('out').textContent = 'Modelo não encontrado: ' + name;
      return;
    }
    el('method').value = t.method;
    el('url').value = t.url;
    el('payload').value = pretty(t.payload);
    el('out').textContent = 'Modelo carregado: ' + t.method + ' ' + t.url + '\\nSubstitua os campos INFORME_... quando existirem e clique em Executar chamada selecionada.';
  }

  async function runPreparedAction() {
    var method = el('method').value.trim().toUpperCase();
    var url = el('url').value.trim();
    var body;

    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = JSON.parse(el('payload').value || '{}');
      } catch (e) {
        el('out').textContent = 'JSON inválido: ' + e.message;
        return;
      }
    }

    el('out').textContent = 'Executando ' + method + ' ' + url + '...';

    try {
      var response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: (method === 'GET' || method === 'HEAD') ? undefined : JSON.stringify(body)
      });
      var text = await response.text();
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
      el('out').textContent = method + ' ' + url + '\\nHTTP ' + response.status + '\\n' + (typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
    } catch (e) {
      el('out').textContent = 'Erro local: ' + e.message;
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-action]');
    if (btn) {
      prepareAction(btn.getAttribute('data-action'));
    }
  });

  el('run-action').addEventListener('click', runPreparedAction);
  window.prepareAction = prepareAction;
  window.runPreparedAction = runPreparedAction;
  prepareAction('pollAck');
})();
</script>
`);
}

app.get('/hub/homologacao', (req, res) => res.send(homologacaoPage()));
app.get('/api/homologacao/routes', (req, res) => res.json({ ok: true, merchantId: process.env.UAIRANGO_MERCHANT_ID, catalogId: process.env.UAIRANGO_CATALOG_ID, rotas: {
  order: ['/sync/orders/poll-uairango', '/api/orders/:orderId/confirm', '/api/orders/:orderId/ready', '/api/orders/:orderId/dispatch', '/api/orders/:orderId/cancel'],
  merchant: ['/api/homologacao/merchants', '/api/homologacao/merchants/:merchantId', '/api/homologacao/merchants/:merchantId/status', '/api/homologacao/merchants/:merchantId/status'],
  catalog: ['/api/homologacao/catalogs/:merchantId', '/api/homologacao/catalogs/:merchantId/products', '/api/homologacao/catalogs/:merchantId/products/:productId', '/api/homologacao/catalogs/:merchantId/:catalogId/categories', '/api/homologacao/catalogs/:merchantId/:catalogId/categories', '/api/homologacao/catalogs/:merchantId/:catalogId/categories/:categoryId', '/api/homologacao/catalogs/:merchantId/categories/:categoryId/items', '/api/homologacao/catalogs/:merchantId/items', '/api/homologacao/catalogs/:merchantId/items/:itemId/flat', '/api/homologacao/catalogs/:merchantId/items/price', '/api/homologacao/catalogs/:merchantId/items/status', '/api/homologacao/catalogs/:merchantId/option-groups', '/api/homologacao/catalogs/:merchantId/options/price', '/api/homologacao/catalogs/:merchantId/options/status']
}}));

app.get('/api/homologacao/merchants', (req, res) => runUai(res, 'GET /merchant/v1.0/merchants', (api) => uai.listarMerchants(api)));
app.get('/api/homologacao/merchants/:merchantId', (req, res) => runUai(res, 'GET /merchant/v1.0/merchants/{merchantId}', (api) => uai.buscarMerchant(api, defaultMerchantId(req))));

app.get('/api/homologacao/merchants/:merchantId/interruptions', (req, res) => runUai(res, 'GET /merchant/v1.0/merchants/{merchantId}/interruptions', (api) => uai.listarInterrupcoesMerchant(api, defaultMerchantId(req))));
app.post('/api/homologacao/merchants/:merchantId/interruptions', (req, res) => runUai(res, 'POST /merchant/v1.0/merchants/{merchantId}/interruptions', (api) => uai.criarInterrupcaoMerchant(api, defaultMerchantId(req), req.body || {})));
app.delete('/api/homologacao/merchants/:merchantId/interruptions/:interruptionId', (req, res) => runUai(res, 'DELETE /merchant/v1.0/merchants/{merchantId}/interruptions/{interruptionId}', (api) => uai.removerInterrupcaoMerchant(api, defaultMerchantId(req), req.params.interruptionId)));

app.get('/api/homologacao/merchants/:merchantId/status', (req, res) => runUai(res, 'GET /merchant/v1.0/merchants/{merchantId}/status', (api) => uai.buscarStatusMerchant(api, defaultMerchantId(req))));
app.put('/api/homologacao/merchants/:merchantId/status', (req, res) => runUai(res, 'PUT /merchant/v1.0/merchants/{merchantId} (status loja)', (api) => uai.atualizarStatusMerchant(api, defaultMerchantId(req), req.body || {})));

app.get('/api/homologacao/orders/:orderId', (req, res) => runUai(res, 'GET /order/v1.0/orders/{orderId}', (api) => uai.buscarPedido(api, req.params.orderId)));
app.post('/api/homologacao/orders/:orderId/confirm', async (req, res) => { try { res.json(await ordersSync.confirmarPedidoManual(req.params.orderId)); } catch (e) { errorResponse(res, 'Erro em POST /order/v1.0/orders/{orderId}/confirm', e); } });
app.post('/api/homologacao/orders/:orderId/ready', (req, res) => runUai(res, 'POST /order/v1.0/orders/{orderId}/readyToPickup', (api) => uai.prontoParaRetirada(api, req.params.orderId)));
app.post('/api/homologacao/orders/:orderId/dispatch', (req, res) => runUai(res, 'POST /order/v1.0/orders/{orderId}/dispatch', (api) => uai.despacharPedido(api, req.params.orderId)));
app.get('/api/homologacao/orders/:orderId/cancellationReasons', (req, res) => runUai(res, 'GET /order/v1.0/orders/{orderId}/cancellationReasons', (api) => uai.listarMotivosCancelamento(api, req.params.orderId)));
app.post('/api/homologacao/orders/:orderId/cancel', (req, res) => runUai(res, 'POST /order/v1.0/orders/{orderId}/requestCancellation', (api) => uai.solicitarCancelamento(api, req.params.orderId, req.body || {})));


app.get('/api/homologacao/catalogs/:merchantId', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/catalogs', (api) => uai.listarCatalogos(api, defaultMerchantId(req))));

app.get('/api/homologacao/catalogs/:merchantId/products', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/products', (api) => uai.listarProdutos(api, defaultMerchantId(req), Number(req.query.page || 1), Number(req.query.limit || 200))));
app.post('/api/homologacao/catalogs/:merchantId/products', (req, res) => runUai(res, 'POST /catalog/v2.0/merchants/{merchantId}/products', (api) => uai.criarProduto(api, defaultMerchantId(req), req.body || {})));
app.put('/api/homologacao/catalogs/:merchantId/products/:productId', (req, res) => runUai(res, 'PUT /catalog/v2.0/merchants/{merchantId}/products/{productId}', (api) => uai.editarProduto(api, defaultMerchantId(req), req.params.productId, req.body || {})));

app.get('/api/homologacao/catalogs/:merchantId/:catalogId/categories', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories', (api) => uai.listarCategorias(api, defaultMerchantId(req), defaultCatalogId(req), true)));
app.post('/api/homologacao/catalogs/:merchantId/:catalogId/categories', (req, res) => runUai(res, 'POST /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories', (api) => uai.criarCategoria(api, defaultMerchantId(req), defaultCatalogId(req), sampleCategoryPayload(req))));
app.patch('/api/homologacao/catalogs/:merchantId/:catalogId/categories/:categoryId', (req, res) => runUai(res, 'PATCH /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories/{categoryId}', (api) => uai.editarCategoria(api, defaultMerchantId(req), defaultCatalogId(req), req.params.categoryId, req.body || {})));
app.get('/api/homologacao/catalogs/:merchantId/categories/:categoryId/items', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/categories/{categoryId}/items', (api) => uai.listarItensDaCategoria(api, defaultMerchantId(req), req.params.categoryId)));
app.get('/api/homologacao/catalogs/:merchantId/items/:itemId/flat', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/items/{itemId}/flat', (api) => uai.buscarItemFlat(api, defaultMerchantId(req), req.params.itemId)));
app.get('/api/homologacao/catalogs/:merchantId/option-groups', (req, res) => runUai(res, 'GET /catalog/v2.0/merchants/{merchantId}/optionGroups', (api) => uai.listarGruposOpcao(api, defaultMerchantId(req), true)));
app.put('/api/homologacao/catalogs/:merchantId/items', (req, res) => runUai(res, 'PUT /catalog/v2.0/merchants/{merchantId}/items', (api) => uai.criarOuAtualizarItem(api, defaultMerchantId(req), sampleItemPayload(req))));
app.patch('/api/homologacao/catalogs/:merchantId/items/price', (req, res) => runUai(res, 'PATCH /catalog/v2.0/merchants/{merchantId}/items/price', (api) => uai.editarPrecoItem(api, defaultMerchantId(req), Object.keys(req.body || {}).length ? req.body : [{ externalCode: 'INFORME_EXTERNAL_CODE', price: { value: 1.99, originalValue: 1.99 } }])));
app.patch('/api/homologacao/catalogs/:merchantId/items/status', (req, res) => runUai(res, 'PATCH /catalog/v2.0/merchants/{merchantId}/items/status', (api) => uai.editarStatusItem(api, defaultMerchantId(req), Object.keys(req.body || {}).length ? req.body : [{ externalCode: 'INFORME_EXTERNAL_CODE', status: 'AVAILABLE' }])));
app.patch('/api/homologacao/catalogs/:merchantId/options/price', (req, res) => runUai(res, 'PATCH /catalog/v2.0/merchants/{merchantId}/options/price', (api) => uai.atualizarPrecoOpcao(api, defaultMerchantId(req), Object.keys(req.body || {}).length ? req.body : [{ externalCode: 'INFORME_EXTERNAL_CODE_OPCAO', price: { value: 1.99, originalValue: 1.99 } }])));
app.patch('/api/homologacao/catalogs/:merchantId/options/status', (req, res) => runUai(res, 'PATCH /catalog/v2.0/merchants/{merchantId}/options/status', (api) => uai.atualizarStatusOpcao(api, defaultMerchantId(req), Object.keys(req.body || {}).length ? req.body : [{ externalCode: 'INFORME_EXTERNAL_CODE_OPCAO', status: 'AVAILABLE' }])));

app.get('/hub/products', (req, res) => {
  const products = store.listProducts({ limit: Number(req.query.limit || 200), status: req.query.status, q: req.query.q });
  const stats = store.dashboardStats();

  const rows = products.map((p) => `
<tr>
<td><code>${p.liProductId}</code></td>
<td>${p.name || '-'}</td>
<td><span class="status">${p.status || '-'}</span></td>
<td><code>${p.uaiProductId || '-'}</code></td>
<td><code>${p.uaiItemId || '-'}</code></td>
<td>${formatPriceBR(p.price)}</td>
<td>${p.updatedAt || '-'}</td>
</tr>`).join('');

  res.send(page('Hub de produtos', `
<h1>Hub de produtos LI → UaiRango</h1>

<div class="card">
<b>Total:</b> ${stats.totalProducts} produtos<br>
<span class="muted">DB: ${stats.dbFile}</span>
</div>

<div class="card">
<a class="btn" href="/hub/orders">Pedidos</a>
<a class="btn" href="/hub/homologacao">Homologação</a>
<a class="btn" href="/api/products">API produtos</a>
<form style="display:inline" method="post" action="/sync/products">
<button class="btn" style="border:0;cursor:pointer">Sincronizar produtos</button>
</form>
</div>

<table>
<thead>
<tr>
<th>ID LI</th>
<th>Produto</th>
<th>Status</th>
<th>Produto Uai</th>
<th>Item Uai</th>
<th>Preço</th>
<th>Atualizado</th>
</tr>
</thead>
<tbody>
${rows || '<tr><td colspan="7">Nenhum produto sincronizado ainda.</td></tr>'}
</tbody>
</table>
`));
});

// restante do código continua igual...

app.get('/hub/products/:liProductId', (req, res) => {
  const product = store.getProduct(req.params.liProductId);
  if (!product) return res.status(404).send(page('Produto não encontrado', '<h1>Produto não encontrado</h1>'));
  res.send(page(`Produto ${product.liProductId}`, `<h1>${product.name || product.liProductId}</h1><div class="card"><p><b>Status:</b> ${product.status || '-'}<br><b>ID LI:</b> ${product.liProductId}<br><b>Produto Uai:</b> ${product.uaiProductId || '-'}<br><b>Item Uai:</b> ${product.uaiItemId || '-'}</p></div><div class="card"><h2>Dados</h2><pre>${JSON.stringify(product, null, 2)}</pre></div>`));
});
app.get('/api/products', (req, res) => res.json({ stats: store.dashboardStats(), products: store.listProducts({ limit: Number(req.query.limit || 200), status: req.query.status, q: req.query.q }) }));

app.get('/api/orders', (req, res) => res.json({ stats: store.dashboardStats(), orders: store.listOrders({ limit: Number(req.query.limit || 100), status: req.query.status, q: req.query.q }) }));
app.get('/api/orders/:orderId', (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });
  res.json(order);
});
app.post('/api/orders/:orderId/confirm', async (req, res) => { try { res.json(await ordersSync.confirmarPedidoManual(req.params.orderId)); } catch (e) { errorResponse(res, 'Erro ao confirmar pedido', e); } });
app.post('/api/orders/:orderId/ready', async (req, res) => { try { res.json(await ordersSync.marcarProntoRetirada(req.params.orderId)); } catch (e) { errorResponse(res, 'Erro ao marcar pedido pronto', e); } });
app.post('/api/orders/:orderId/dispatch', async (req, res) => { try { res.json(await ordersSync.despacharPedido(req.params.orderId)); } catch (e) { errorResponse(res, 'Erro ao despachar pedido', e); } });
app.post('/api/orders/:orderId/cancel', async (req, res) => { try { res.json(await ordersSync.cancelarPedidoUaiRango(req.params.orderId, req.body?.reason)); } catch (e) { errorResponse(res, 'Erro ao cancelar pedido', e); } });
app.post('/api/orders/:orderId/retry-li', async (req, res) => { try { res.json(await ordersSync.retryLiImport(req.params.orderId)); } catch (e) { errorResponse(res, 'Erro ao retentar LI', e); } });

app.post('/sync/products', async (req, res) => { try { res.json(await sincronizarTodosProdutos()); } catch (e) { errorResponse(res, 'Erro ao sincronizar produtos', e); } });
app.post('/sync/stock', async (req, res) => { try { res.json(await sincronizarTodosEstoques()); } catch (e) { errorResponse(res, 'Erro ao sincronizar estoques', e); } });
app.post('/sync/orders/poll-uairango', async (req, res) => { try { res.json(await ordersSync.processarEventosUaiRango()); } catch (e) { errorResponse(res, 'Erro ao processar eventos UaiRango', e); } });
app.post('/webhooks/lojaintegrada/pedido', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const expected = `Bearer ${process.env.LI_WEBHOOK_TOKEN}`;
    if (process.env.LI_WEBHOOK_TOKEN && auth !== expected) return res.status(401).json({ message: 'Unauthorized' });
    const pedidoLI = req.body;
    if (!pedidoLI?.situacao?.situacao_alterada) return res.json({ ignored: true, motivo: 'situacao_nao_alterada' });
    const orderIdUai = pedidoLI?.marketplace_info?.id_externo_unico || pedidoLI?.integration_data?.external_id || pedidoLI?.id_externo || null;
    if (!orderIdUai) return res.json({ ignored: true, motivo: 'sem_order_id_uairango' });
    res.json(await ordersSync.atualizarStatusUaiRangoAPartirDaPedidoLI(pedidoLI, String(orderIdUai)));
  } catch (e) { errorResponse(res, 'Erro no webhook de pedido da Loja Integrada', e); }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Hub rodando em http://localhost:${PORT}/hub/orders`));
