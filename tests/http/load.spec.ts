import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { thresholds } from '../../config/index.ts';
import { checkQuotes, checkRecommendation, getQuotes, recommendPizza } from '../../services/quickpizza.service.ts';

// Perfil pequeno para o ambiente público de demonstração do QuickPizza.
export const options: Options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 2 },
        { duration: '20s', target: 2 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: thresholds.load,
};

export default function (): void {
  checkQuotes(getQuotes());
  checkRecommendation(recommendPizza());
  sleep(1);
}
