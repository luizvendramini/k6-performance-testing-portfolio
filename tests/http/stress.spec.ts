/**
 * tests/http/stress.spec.ts
 *
 * Stress test: empurra a carga deliberadamente ALEM da capacidade normal,
 * para descobrir ONDE e COMO o sistema degrada (throughput cai? latencia
 * explode? comeca a devolver erro 5xx?). Diferente do load test, aqui
 * esperamos ver degradacao - o que valida e a taxa de ERRO continuar
 * controlada e a recuperacao ser limpa na rampa de descida, nao a latencia
 * ficar baixa (por isso os thresholds em config/index.ts sao mais
 * tolerantes a duracao, porem ainda rigidos quanto a `http_req_failed`).
 *
 * Executor: `ramping-vus` com duas rampas sucessivas (10 -> 20 -> 40 VUs),
 * simulando crescimo de carga alem do esperado antes de aliviar.
 */
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { productsService, checkListResponse, checkSearchResponse } from '../../services/products.service.ts';
import { thresholds } from '../../config/index.ts';

export const options: Options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 20 }, // acima da carga normal (load test usa 10)
        { duration: '15s', target: 40 }, // bem alem da capacidade esperada
        { duration: '20s', target: 40 }, // sustenta o pico para observar degradacao
        { duration: '10s', target: 0 }, // rampa de descida: o sistema se recupera?
      ],
    },
  },
  thresholds: thresholds.stress,
};

export default function (): void {
  checkListResponse(productsService.list());
  checkSearchResponse(productsService.search('mouse'));
  sleep(0.5);
}
