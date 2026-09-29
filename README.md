# k6 Performance Testing Portfolio

Portfólio executável de performance com Grafana k6 e TypeScript contra o [QuickPizza](https://quickpizza.grafana.com/), aplicação de demonstração da Grafana. Os testes usam a interface e a API reais do QuickPizza: página inicial, citações e geração de recomendações de pizza.

## O que os cenários cobrem

| Cenário | Comando | Uso |
|---|---|---|
| Smoke | `npm run test:smoke` | Confere página inicial, API de citações e geração de pizza com 1 VU por 10 segundos. |
| Load | `npm run test:load` | Carga leve: até 2 VUs por cerca de 40 segundos. Adequada para experimentar no QuickPizza público. |
| Stress | `npm run test:stress` | Cresce até 25 VUs para observar degradação. Execute somente em ambiente seu/local. |
| Spike | `npm run test:spike` | Salta até 25 VUs para observar a resposta a um pico. Execute somente em ambiente seu/local. |
| Soak | `npm run test:soak` | Mantém 5 VUs por 5 minutos para observar degradação ao longo do tempo. Execute somente em ambiente seu/local. |
| Browser | `npm run test:browser` | Abre Chromium, gera uma pizza pela interface e mede Web Vitals. |

Os perfis stress, spike e soak exigem `ALLOW_HEAVY_TESTS=true` de propósito. A URL padrão é o site público de demonstração; para esses cenários, aponte para uma instância QuickPizza local ou para um ambiente que você administra.

## Começar agora

Requisitos: Node.js 18+, Grafana k6 1.0+ e, para o perfil Browser, Chromium compatível com k6 browser.

```bash
npm install
npm run typecheck
npm run test:smoke
```

O destino padrão é `https://quickpizza.grafana.com`. O token abaixo é o token público de prática documentado pela Grafana para essa aplicação. Para apontar a um ambiente diferente, informe `BASE_URL` e `TOKEN`:

```bash
BASE_URL=http://localhost:3333 TOKEN=abcdef0123456789 npm run test:smoke
```

Para iniciar uma instância local real do QuickPizza com Docker:

```bash
docker run --rm -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest
```

Em outro terminal, execute cenários de maior carga somente contra essa instância ou outro alvo que você controla:

```bash
BASE_URL=http://localhost:3333 ALLOW_HEAVY_TESTS=true npm run test:stress
BASE_URL=http://localhost:3333 ALLOW_HEAVY_TESTS=true npm run test:spike
BASE_URL=http://localhost:3333 ALLOW_HEAVY_TESTS=true npm run test:soak
```

Para o teste Browser, se o Chromium não estiver em um caminho reconhecido pelo k6, defina `K6_BROWSER_EXECUTABLE_PATH`. Em ambientes Linux sem sandbox, também pode ser necessário `K6_BROWSER_ARGS=no-sandbox`.

## Resultados e thresholds

Cada cenário valida status HTTP e conteúdo útil das respostas. A API de recomendação também verifica que a pizza retornada contém massa e ingredientes e respeita a restrição vegetariana. Os limites de aprovação ficam em `config/index.ts`.

Para salvar um resumo local:

```bash
k6 run --summary-export=summary.json tests/http/smoke.spec.ts
```

## CI

O workflow `smoke.yml` verifica os tipos e roda o smoke test em cada push e pull request para `main`. A suíte não depende de serviços mockados neste repositório; ela exerce o QuickPizza de verdade.

## Referências

- [QuickPizza da Grafana](https://github.com/grafana/quickpizza)
- [OpenAPI do QuickPizza](https://github.com/grafana/quickpizza/blob/main/quickpizza-openapi.yaml)
- [Documentação do Grafana k6](https://grafana.com/docs/k6/latest/)
