/**
 * tests/http/spike.spec.ts
 *
 * Spike test: um pico de carga SUBITO e de curta duracao (ex: um link
 * viralizou, uma campanha de marketing disparou), seguido de queda igualmente
 * brusca. O que se valida e diferente do stress test: nao e "ate onde
 * aguenta", e "o sistema sobrevive a um choque e volta ao normal
 * rapidamente depois?".
 *
 * Executor: `ramping-vus` com rampa de subida muito curta (poucos segundos
 * para ir de 0 a 50 VUs) - a caracteristica que define um spike e a
 * VELOCIDADE da rampa, nao so o valor de pico.
 */
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { productsService, checkListResponse } from '../../services/products.service.ts';
import { thresholds } from '../../config/index.ts';

export const options: Options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 5 }, // aquecimento minimo
        { duration: '5s', target: 50 }, // pico subito - rampa curta de proposito
        { duration: '15s', target: 50 }, // sustenta o pico brevemente
        { duration: '5s', target: 5 }, // queda tao brusca quanto a subida
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: thresholds.spike,
};

export default function (): void {
  checkListResponse(productsService.list());
  sleep(0.3);
}
