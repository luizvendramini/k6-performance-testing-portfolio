/**
 * mock-services/server.ts
 *
 * Aplicacao "alvo" dos testes de performance: uma API REST + um endpoint
 * WebSocket, 100% local e sem dependencias externas de rede em runtime.
 *
 * Por que uma mock-app local em vez de apontar o k6 para uma API publica
 * (ex: test.k6.io)?
 *  - Determinismo: os thresholds (limites de latencia/erro) definidos nos
 *    testes so fazem sentido se o comportamento do "alvo" for estavel e sob
 *    nosso controle. Uma API publica compartilhada por milhares de usuarios
 *    de tutoriais de k6 mundo afora introduziria ruido que mascara
 *    regressoes reais.
 *  - CI sem dependencia de rede externa: o pipeline sobe este servidor,
 *    roda os testes contra "localhost" e derruba o servidor. Nada de rate
 *    limit, indisponibilidade de terceiros ou dados que mudam entre runs.
 *  - Permite simular, de forma controlada, os cenarios que queremos provar
 *    que sabemos detectar: uma rota deliberadamente mais lenta
 *    (/api/products/search) e degradacao sob carga (ver comentario mais
 *    abaixo em `delay`).
 *
 * Este arquivo reaproveita o mesmo estilo de "mock-app" ja usado no
 * portfolio de Playwright (http nativo do Node, sem framework), mantendo a
 * consistencia entre os projetos do portfolio.
 */
import http, { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { URL } from 'url';
import { upgradeToWebSocket, isWebSocketUpgrade } from './lib/minimal-ws.ts';
import type { MinimalWsConnection } from './lib/minimal-ws.ts';

// ---------------------------------------------------------------------------
// "Banco de dados" em memoria
// ---------------------------------------------------------------------------
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

let PRODUCTS: Product[] = [
  { id: 1, name: 'Teclado Mecanico', category: 'perifericos', price: 249.9 },
  { id: 2, name: 'Mouse Sem Fio', category: 'perifericos', price: 89.5 },
  { id: 3, name: 'Monitor 27" 4K', category: 'monitores', price: 1899.0 },
  { id: 4, name: 'Headset Gamer', category: 'audio', price: 349.0 },
  { id: 5, name: 'Webcam Full HD', category: 'perifericos', price: 199.0 },
];
let nextProductId = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * /store: unica pagina HTML do mock-service, usada exclusivamente pelo
 * teste de carga do modulo k6 browser (tests/browser/product-browsing.spec.ts).
 * Renderiza o catalogo no load (server-side) e faz a busca via fetch()
 * client-side contra a mesma /api/products/search usada pelos testes de
 * protocolo - o browser test e, na pratica, mais uma "camada" de carga
 * sobre a mesma API, nao um sistema paralelo.
 */
function storePageHtml(): string {
  const items = PRODUCTS.map(
    (p) => `<li class="product" data-testid="product-${p.id}">${p.name} - R$ ${p.price.toFixed(2)}</li>`
  ).join('\n');

  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <title>Catalogo | k6 mock-service</title>
  <style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;} li{margin-bottom:6px;}</style>
</head>
<body>
  <h1>Catalogo de produtos</h1>
  <input type="text" id="search-input" data-testid="search-input" placeholder="Buscar produto..." />
  <button id="search-button" data-testid="search-button">Buscar</button>
  <ul id="product-list" data-testid="product-list">
    ${items}
  </ul>
  <script>
    document.getElementById('search-button').addEventListener('click', async () => {
      const q = document.getElementById('search-input').value;
      const res = await fetch('/api/products/search?q=' + encodeURIComponent(q));
      const results = await res.json();
      const list = document.getElementById('product-list');
      list.innerHTML = results
        .map((p) => '<li class="product" data-testid="product-' + p.id + '">' + p.name + ' - R$ ' + p.price.toFixed(2) + '</li>')
        .join('');
    });
  </script>
</body>
</html>`;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Latencia artificial, deliberada e configuravel por rota.
 *
 * O objetivo NAO e simular uma rede real (isso o k6 e a infra do runner ja
 * fazem por conta propria), e sim dar a cada rota um "perfil" de latencia
 * proprio e reproduzivel, para que os testes tenham algo concreto para
 * medir e os thresholds documentados no README facam sentido:
 *  - rotas de leitura simples (GET /api/products) ficam bem rapidas;
 *  - a rota de busca (/api/products/search) e deliberadamente mais pesada
 *    (varre a lista inteira), demonstrando como definir thresholds
 *    diferentes por tag/rota em vez de um unico limite global.
 */
function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Rotas HTTP
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { status: 'ok' });
    }

    if (method === 'GET' && pathname === '/store') {
      return sendHtml(res, 200, storePageHtml());
    }

    // Evita que o pedido automatico de favicon do navegador apareca como
    // "requisicao falhada" nas metricas do teste de carga com k6 browser
    // (browser_http_req_failed) - ruido que nao tem nada a ver com o que
    // o teste esta validando.
    if (method === 'GET' && pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    if (method === 'GET' && pathname === '/api/products/search') {
      await delay(120, 350); // rota deliberadamente mais lenta - ver comentario acima
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const results = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q) || p.category.includes(q));
      return sendJson(res, 200, results);
    }

    if (method === 'GET' && pathname === '/api/products') {
      await delay(5, 40);
      return sendJson(res, 200, PRODUCTS);
    }

    const singleProductMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (singleProductMatch) {
      const id = Number(singleProductMatch[1]);
      await delay(5, 40);

      if (method === 'GET') {
        const product = PRODUCTS.find((p) => p.id === id);
        if (!product) return sendJson(res, 404, { error: 'Produto nao encontrado' });
        return sendJson(res, 200, product);
      }

      if (method === 'PUT') {
        const idx = PRODUCTS.findIndex((p) => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Produto nao encontrado' });
        const body = await readBody(req);
        PRODUCTS[idx] = { ...PRODUCTS[idx], ...body, id };
        return sendJson(res, 200, PRODUCTS[idx]);
      }

      if (method === 'DELETE') {
        const idx = PRODUCTS.findIndex((p) => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Produto nao encontrado' });
        PRODUCTS.splice(idx, 1);
        return sendJson(res, 204, undefined);
      }
    }

    if (method === 'POST' && pathname === '/api/products') {
      await delay(10, 60);
      const body = await readBody(req);
      const { name, category, price } = body as Partial<Product>;
      if (!name || typeof price !== 'number') {
        return sendJson(res, 400, { error: 'Campos obrigatorios: name (string) e price (number)' });
      }
      const product: Product = { id: nextProductId++, name, category: category ?? 'geral', price };
      PRODUCTS.push(product);
      return sendJson(res, 201, product);
    }

    // Rota utilitaria: devolve o catalogo ao estado inicial. Usada pelo
    // teardown() dos testes de carga, para que uma execucao (que cria
    // produtos via POST) nao deixe o "banco" cada vez maior para a proxima.
    if (method === 'POST' && pathname === '/api/products/reset') {
      PRODUCTS = [
        { id: 1, name: 'Teclado Mecanico', category: 'perifericos', price: 249.9 },
        { id: 2, name: 'Mouse Sem Fio', category: 'perifericos', price: 89.5 },
        { id: 3, name: 'Monitor 27" 4K', category: 'monitores', price: 1899.0 },
        { id: 4, name: 'Headset Gamer', category: 'audio', price: 349.0 },
        { id: 5, name: 'Webcam Full HD', category: 'perifericos', price: 199.0 },
      ];
      nextProductId = 6;
      return sendJson(res, 200, { status: 'reset' });
    }

    return sendJson(res, 404, { error: 'Rota nao encontrada' });
  } catch (err) {
    return sendJson(res, 500, { error: 'Erro interno', detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// WebSocket: /ws/chat
//
// Protocolo simples, propositalmente inspirado em uma sala de chat/eventos:
//  - ao conectar, o servidor envia { type: 'welcome' };
//  - toda mensagem { type: 'message', text } recebida e ecoada de volta como
//    { type: 'echo', text, receivedAt };
//  - o servidor tambem envia um { type: 'ping' } periodico, para exercitar
//    testes que validam mensagens *assincronas*, nao so request/response.
//
// O upgrade HTTP -> WebSocket e tratado por mock-services/lib/minimal-ws.ts
// (implementacao minima do RFC 6455, sem depender do pacote `ws`).
// ---------------------------------------------------------------------------
server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (!isWebSocketUpgrade(req) || pathname !== '/ws/chat') {
    socket.destroy();
    return;
  }

  const connection: MinimalWsConnection | null = upgradeToWebSocket(req, socket);
  if (!connection) return;

  connection.send({ type: 'welcome' });

  const pingInterval = setInterval(() => {
    connection.send({ type: 'ping', at: Date.now() });
  }, 5_000);

  connection.onMessage((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'message') {
        connection.send({ type: 'echo', text: parsed.text, receivedAt: Date.now() });
      }
    } catch {
      connection.send({ type: 'error', reason: 'payload invalido' });
    }
  });

  connection.onClose(() => clearInterval(pingInterval));
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`mock-services/server.ts rodando em http://localhost:${PORT}`));

export default server;
