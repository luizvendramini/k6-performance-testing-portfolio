# k6 Performance Testing Portfolio

Portfolio de **testes de performance/carga** com [k6](https://k6.io/) + TypeScript, cobrindo os quatro protocolos que o k6 testa nativamente — **HTTP/REST**, **WebSocket**, **gRPC** e **Browser** (navegador real, via [k6 browser](https://grafana.com/docs/k6/latest/using-k6-browser/)) — e os cinco padroes classicos de teste de carga: **smoke, load, stress, spike e soak**.

Complementa os portfolios de [Playwright](https://github.com/luizvendramini/playwright-qa-portfolio) (funcional Web/API) e [WebdriverIO + Appium](https://github.com/luizvendramini/appium-webdriverio-mobile-portfolio) (mobile): juntos, cobrem funcional, mobile e performance.

## Objetivo

Demonstrar, na pratica:

- **Os cinco tipos de teste de carga** (smoke/load/stress/spike/soak) e quando usar cada um.
- **Cobertura multi-protocolo**: HTTP, WebSocket, gRPC e Browser — o k6 nao serve so para "bater na API".
- **Reuso e manutenibilidade**: um padrao de "Service Object" (a adaptacao natural do Page Object Model para testes de protocolo) para HTTP/WebSocket/gRPC, e um Page Object de verdade (compativel com a API do Playwright) para o teste de Browser.
- **Thresholds como criterio de aprovacao/reprovacao objetivo**, nao so "olhar o grafico depois".
- **Suite 100% deterministica**: todo "alvo" dos testes e uma mock-service local, sem dependencia de rede externa.
- **CI dividido por intencao**: validacao rapida (smoke) em todo push/PR, e testes de carga pesada sob demanda/agendados — nao a cada commit.

## Por que mock-services locais em vez de uma API publica de demonstracao?

Os mesmos motivos ja documentados no portfolio de Playwright se aplicam aqui, com um agravante: em testes de **performance**, depender de um servico de terceiros e ainda pior, porque a latencia observada passaria a refletir a rede/capacidade de terceiros, nao o comportamento que o teste quer medir — os thresholds definidos em `config/index.ts` simplesmente nao fariam sentido.

Por isso, `mock-services/` sobe local (e no CI) tres "alvos" antes da suite rodar:

- **HTTP + WebSocket** (`mock-services/server.ts`): API REST de produtos (`/api/products`, CRUD completo), uma pagina HTML simples para o teste de Browser (`/store`) e um endpoint de chat via WebSocket (`/ws/chat`) — tudo em **Node `http` nativo, sem nenhuma dependencia de runtime** (o proprio WebSocket foi implementado a mao em `mock-services/lib/minimal-ws.ts`, um RFC 6455 minimo, em vez de trazer o pacote `ws`).
- **gRPC** (`mock-services/grpc/server.ts`): servico `Greeter` minimo (`@grpc/grpc-js` + `@grpc/proto-loader`), com um metodo unario e um com streaming do servidor.

## Estrutura do projeto

```
k6-performance-testing-portfolio/
├── mock-services/
│   ├── server.ts              # API REST + pagina /store + WebSocket (zero deps de runtime)
│   ├── lib/minimal-ws.ts      # WebSocket (RFC 6455) implementado nativamente
│   └── grpc/
│       ├── greeter.proto
│       └── server.ts          # servidor gRPC (@grpc/grpc-js)
├── config/
│   └── index.ts               # ambientes (local/staging) e thresholds por tipo de teste
├── data/
│   └── products.seed.json     # massa de dados (SharedArray) para testes data-driven
├── services/                  # "Service Object" / Page Object - camada de reuso entre os specs
│   ├── products.service.ts    # requests + checks HTTP
│   ├── chat.service.ts        # conexao/protocolo WebSocket
│   ├── greeter.service.ts     # cliente gRPC
│   └── store.page.ts          # Page Object da pagina /store (usado pelo teste de Browser)
├── tests/
│   ├── http/                  # smoke, load, stress, spike, soak
│   ├── websocket/
│   ├── grpc/
│   └── browser/
└── .github/workflows/
    ├── smoke.yml               # todo push/PR: HTTP smoke + WebSocket + gRPC (rapido)
    └── load-suite.yml          # manual/semanal: load, stress, spike, soak + Browser (mais lento)
```

## Os cinco tipos de teste de carga

| Tipo | Arquivo | O que valida | Executor |
|---|---|---|---|
| **Smoke** | `tests/http/smoke.spec.ts` | O sistema funciona, com o minimo de carga. Primeiro teste a rodar - se falhar, nem vale a pena rodar o resto. | `constant-vus` (2 VUs) |
| **Load** | `tests/http/load.spec.ts` | Comportamento sob a carga **esperada** em producao (SLA). | `ramping-vus` (rampa/plato/rampa) |
| **Stress** | `tests/http/stress.spec.ts` | Onde e como o sistema degrada acima da capacidade normal. | `ramping-vus` (rampas progressivas) |
| **Spike** | `tests/http/spike.spec.ts` | Sobrevive a um pico subito de trafego e se recupera rapido? | `ramping-vus` (rampa muito curta) |
| **Soak** | `tests/http/soak.spec.ts` | Vazamento de memoria/conexao que so aparece com carga sustentada por tempo. | `constant-vus` (duracao longa) |

> As duracoes usadas aqui sao propositalmente curtas (segundos a poucos minutos), para manter o portfolio rapido de rodar local e no CI. Em um projeto real, load/soak em especial rodariam por dezenas de minutos a horas — muda so o valor de `duration`/`stages`, a estrutura do script e a mesma.

Os thresholds de cada tipo (limite de latencia, taxa de erro aceitavel) ficam centralizados em `config/index.ts`, com o racional de cada um comentado ali.

## Cobertura multi-protocolo

Alem de HTTP, o k6 testa carga sobre outros protocolos nativamente (sem plugins/extensoes):

- **WebSocket** (`tests/websocket/chat-echo.spec.ts`): N conexoes simultaneas trocando mensagens em tempo real com o servidor.
- **gRPC** (`tests/grpc/greeter.spec.ts`): chamada unaria e chamada com streaming do servidor, via `k6/net/grpc` (cliente nativo do k6 - nenhuma dependencia extra no lado do teste).
- **Browser** (`tests/browser/product-browsing.spec.ts`): abre Chromium real (headless) e navega pela pagina `/store` como um usuario faria - inclui metricas de Web Vitals (LCP, FCP, CLS, INP). Usa um Page Object (`services/store.page.ts`) com a mesma API do Playwright, ja que o modulo `k6/browser` foi desenhado para ser compativel.

## Como rodar localmente

```bash
npm install

# Sobe a API REST + WebSocket (porta 3000)
npm run mock:http
# Em outro terminal, sobe o servico gRPC (porta 50051) - so necessario para test:grpc
npm run mock:grpc
```

Com as mock-services no ar, em outro terminal:

```bash
npm run test:smoke     # HTTP - smoke
npm run test:load      # HTTP - load
npm run test:stress    # HTTP - stress
npm run test:spike     # HTTP - spike
npm run test:soak      # HTTP - soak
npm run test:ws        # WebSocket
npm run test:grpc      # gRPC
npm run test:browser   # Browser (requer Chromium instalado)
npm run typecheck      # checagem de tipos do projeto inteiro
```

Todo teste aceita `-e ENVIRONMENT=staging` (ver `config/index.ts`) para apontar para outro ambiente sem alterar nenhum script.

### Relatorios

Qualquer execucao pode gerar um relatorio HTML autocontido (sem dependencia externa, recurso nativo do k6) e um resumo em JSON:

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=reports/load.html npm run test:load -- --summary-export=reports/load-summary.json
```

### Teste de Browser: Chromium fora do padrao / rodando como root

O modulo `k6/browser` detecta um Chrome/Chromium instalado no sistema. Se o binario estiver em um caminho nao padrao, ou a execucao for como root (ex: dentro de um container), configure:

```bash
K6_BROWSER_EXECUTABLE_PATH=/caminho/para/chromium K6_BROWSER_ARGS=no-sandbox npm run test:browser
```

## CI

Dois workflows, com intencoes diferentes (ver racional completo nos comentarios de cada arquivo):

- **[`smoke.yml`](.github/workflows/smoke.yml)** — todo push/PR na `main`: typecheck + smoke (HTTP) + WebSocket + gRPC. Rapido (poucos minutos) e deterministico, da confianca de que os tres protocolos continuam funcionais a cada commit.
- **[`load-suite.yml`](.github/workflows/load-suite.yml)** — disparo manual ou semanal (segunda-feira): load, stress, spike, soak e Browser, publicando os relatorios HTML como artefato do workflow. Nao roda a cada push de proposito: sao testes mais pesados (o de Browser depende de Chromium) e carga/capacidade e algo que se acompanha periodicamente, nao a cada linha alterada.

## Uma observacao sobre o exemplo de gRPC

O cliente gRPC do k6 (`k6/net/grpc`) e nativo - o teste em si (`tests/grpc/greeter.spec.ts`) nao depende de nenhum pacote externo. Ja o **mock-service** gRPC (`mock-services/grpc/server.ts`) usa `@grpc/grpc-js` e `@grpc/proto-loader`, que sao resolvidos normalmente pelo `npm install` no CI e em qualquer maquina com acesso padrao ao registry do npm. O par cliente(k6)/servidor(mock-service) foi implementado seguindo estritamente a API oficial documentada pela Grafana e pela equipe do `grpc-js`; fica registrado aqui como nota de transparencia sobre o processo de validacao, nao como limitacao do codigo em si.

## Stack

- [k6](https://k6.io/) v2.x + TypeScript (suporte nativo a `.ts`, sem bundler/transpiler proprio - ver [release notes do k6 v0.57+](https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/))
- [`k6/net/grpc`](https://grafana.com/docs/k6/latest/javascript-api/k6-net-grpc/) e [`k6/browser`](https://grafana.com/docs/k6/latest/using-k6-browser/) (modulos nativos, sem extensoes)
- Node.js `http`/`net`/`crypto` nativos (mock-services HTTP + WebSocket, zero dependencias de runtime)
- `@grpc/grpc-js` + `@grpc/proto-loader` (mock-service gRPC)
- [`grafana/setup-k6-action`](https://github.com/grafana/setup-k6-action) (CI)
- GitHub Actions (CI)
