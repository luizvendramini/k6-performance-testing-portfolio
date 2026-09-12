/**
 * tests/http/smoke.spec.ts
 *
 * Smoke test: a menor carga possivel (poucas VUs, execucao curta), so para
 * provar que o sistema funciona de ponta a ponta e que os proprios scripts
 * de teste estao corretos. E o primeiro teste que roda em qualquer pipeline
 * de performance - se o smoke falha, nem faz sentido gastar tempo/recursos
 * rodando load/stress/spike/soak.
 *
 * Executor: `constant-vus` com 2 VUs por 20s. Carga fixa e minima, sem
 * rampas - aqui o objetivo nao e simular usuarios reais, e sim validar
 * funcionalidade sob um minimo de concorrencia.
 */
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { productsService, checkListResponse, checkProductResponse } from '../../services/products.service.ts';
import { thresholds } from '../../config/index.ts';

export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 2,
      duration: '20s',
    },
  },
  thresholds: thresholds.smoke,
};

export default function (): void {
  checkListResponse(productsService.list());
  checkProductResponse(productsService.getById(1));
  sleep(1);
}
