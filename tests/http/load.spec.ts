/**
 * tests/http/load.spec.ts
 *
 * Load test: simula a carga "normal" esperada em producao, sustentada por
 * um periodo, para validar que o sistema atende ao SLA sob condicoes
 * realistas do dia a dia (nao e sobre encontrar limites - e sobre provar
 * que o comportamento esperado se mantem).
 *
 * Executor: `ramping-vus` com rampa de subida, plato e rampa de descida -
 * o padrao classico de load test, evitando o "degrau" artificial de
 * comecar direto com N VUs (o que estressaria o sistema de forma irreal).
 *
 * Nota sobre duracao: os estagios abaixo sao propositalmente curtos
 * (~1 min no total) para manter o portfolio rapido de rodar localmente e
 * no CI. Em um projeto real, o plato de um load test costuma durar de
 * 10 a 30 minutos - so os *valores* (VUs alvo, thresholds) precisariam
 * mudar, a estrutura do script seria a mesma.
 */
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { SharedArray } from 'k6/data';
import {
  productsService,
  checkListResponse,
  checkProductResponse,
  checkSearchResponse,
  checkCreateResponse,
} from '../../services/products.service.ts';
import { thresholds } from '../../config/index.ts';

interface ProductsSeed {
  newProducts: { name: string; category: string; price: number }[];
  searchTerms: string[];
}

const seed = new SharedArray('load-seed', function () {
  const data = JSON.parse(open('../../data/products.seed.json')) as ProductsSeed;
  return [data];
})[0] as ProductsSeed;

export const options: Options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 }, // rampa de subida ate a carga alvo
        { duration: '30s', target: 10 }, // plato: carga sustentada
        { duration: '10s', target: 0 }, // rampa de descida
      ],
    },
  },
  thresholds: thresholds.load,
};

export default function (): void {
  // Fluxo tipico de um usuario navegando no catalogo: lista -> busca -> ve
  // um produto especifico. `think time` (sleep) entre acoes simula
  // comportamento humano real, em vez de bater na API sem pausa.
  checkListResponse(productsService.list());
  sleep(1);

  const term = seed.searchTerms[Math.floor(Math.random() * seed.searchTerms.length)];
  checkSearchResponse(productsService.search(term));
  sleep(1);

  const randomId = 1 + Math.floor(Math.random() * 5);
  checkProductResponse(productsService.getById(randomId));
  sleep(1);

  // Uma fracao das iteracoes tambem cria um produto (ex: fluxo de admin
  // cadastrando catalogo), para exercitar o caminho de escrita sob carga.
  if (Math.random() < 0.2) {
    const newProduct = seed.newProducts[Math.floor(Math.random() * seed.newProducts.length)];
    checkCreateResponse(productsService.create(newProduct));
  }
}

/** Devolve o "banco" do mock-service ao estado inicial apos o teste, para nao acumular produtos criados a cada execucao. */
export function teardown(): void {
  productsService.reset();
}
