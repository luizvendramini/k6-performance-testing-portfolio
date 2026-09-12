/**
 * tests/http/soak.spec.ts
 *
 * Soak test (tambem chamado de endurance test): uma carga MODERADA (nao
 * precisa ser alta) sustentada por um periodo LONGO. O objetivo e pegar
 * problemas que so aparecem com o tempo e nao em uma execucao curta de
 * load test: vazamento de memoria, conexoes/handles que nao sao liberados,
 * degradacao gradual de performance, crescimento descontrolado de alguma
 * estrutura em memoria no servidor.
 *
 * Executor: `constant-vus` - carga fixa e simples, sem rampas, porque o
 * unico eixo que importa aqui e o TEMPO, nao o formato da curva de carga.
 *
 * Nota sobre duracao: 90s aqui e um valor "de portfolio/CI". Em um soak
 * test real a duracao tipica e de varias horas - a mudanca seria so no
 * campo `duration`, a logica do teste seria identica.
 */
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { productsService, checkListResponse, checkProductResponse } from '../../services/products.service.ts';
import { thresholds } from '../../config/index.ts';

export const options: Options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 10,
      duration: '90s',
    },
  },
  thresholds: thresholds.soak,
};

export default function (): void {
  checkListResponse(productsService.list());
  checkProductResponse(productsService.getById(1 + (__ITER % 5)));
  sleep(1);
}
