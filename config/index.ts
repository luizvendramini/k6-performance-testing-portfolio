/**
 * config/index.ts
 *
 * Ponto unico de configuracao do portfolio: (1) para qual ambiente os
 * testes apontam e (2) quais thresholds cada tipo de teste usa.
 *
 * Ambientes
 * ---------
 * O ambiente e escolhido via `k6 run -e ENVIRONMENT=local ...` (ou variavel
 * de ambiente equivalente no CI). Por padrao usamos "local", que e o unico
 * ambiente 100% deterministico (mock-services rodando na mesma maquina).
 * "staging" fica aqui como exemplo de como o mesmo conjunto de testes
 * escalaria para um ambiente real, sem duplicar nenhum script de teste.
 */
export type EnvName = 'local' | 'staging';

interface EnvironmentConfig {
  httpBaseUrl: string;
  wsUrl: string;
  grpcAddr: string;
}

const ENVIRONMENTS: Record<EnvName, EnvironmentConfig> = {
  local: {
    httpBaseUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000/ws/chat',
    grpcAddr: 'localhost:50051',
  },
  // Exemplo ilustrativo: em um projeto real, estes valores viriam de
  // secrets/vars do pipeline, nunca hardcoded.
  staging: {
    httpBaseUrl: 'https://staging.example.com',
    wsUrl: 'wss://staging.example.com/ws/chat',
    grpcAddr: 'staging.example.com:443',
  },
};

function currentEnvName(): EnvName {
  const raw = (__ENV.ENVIRONMENT || 'local') as EnvName;
  if (!(raw in ENVIRONMENTS)) {
    throw new Error(`Ambiente desconhecido: "${raw}". Use um de: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  }
  return raw;
}

export const env: EnvironmentConfig = ENVIRONMENTS[currentEnvName()];

/**
 * Thresholds
 * ----------
 * Cada tipo de teste tem uma "intencao" diferente, entao os limites nao sao
 * os mesmos:
 *  - smoke: so precisa provar que o sistema funciona com carga minima.
 *    Threshold apertado, porque qualquer falha aqui e sinal de regressao
 *    funcional, nao de capacidade.
 *  - load: valida o comportamento sob a carga "esperada" em producao.
 *    Threshold reflete o SLA que o time realmente assumiria.
 *  - stress / spike: o objetivo e observar ONDE e COMO o sistema degrada,
 *    entao os thresholds sao mais tolerantes a latencia, mas continuam
 *    rigidos quanto a taxa de erro - nao queremos que o sistema derrube
 *    requisicoes, mesmo se ficar mais lento.
 *  - soak: mesma exigencia do load, mas sustentada por mais tempo, para
 *    pegar vazamento de memoria/conexao que so aparece com o tempo.
 *
 * A tag `endpoint:search` isola o threshold da rota deliberadamente mais
 * lenta (ver mock-services/server.ts), evitando que uma unica rota "pesada"
 * force um limite global mais frouxo para todas as outras.
 */
// Tipado explicitamente como `{ [name: string]: string[] }` (o mesmo shape de
// `Options['thresholds']`) em vez de `as const`: um objeto literal `as const`
// torna cada array um tuplo readonly de strings literais, que o TypeScript
// nao aceita onde a lib de tipos do k6 espera `Threshold[]` (array mutavel).
type ThresholdSet = { [metricName: string]: string[] };

export const thresholds: Record<'smoke' | 'load' | 'stress' | 'spike' | 'soak', ThresholdSet> = {
  smoke: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    checks: ['rate>0.99'],
  },
  load: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    'http_req_duration{endpoint:search}': ['p(95)<700'],
    checks: ['rate>0.99'],
  },
  stress: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95'],
  },
  spike: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.90'],
  },
  soak: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
    checks: ['rate>0.99'],
  },
};
