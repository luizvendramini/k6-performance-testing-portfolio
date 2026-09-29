import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { requireHeavyTestOptIn, thresholds } from '../../config/index.ts';
import { checkRecommendation, recommendPizza } from '../../services/quickpizza.service.ts';

requireHeavyTestOptIn();

export const options: Options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '15s', target: 25 },
        { duration: '20s', target: 25 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: thresholds.stress,
};

export default function (): void {
  checkRecommendation(recommendPizza());
  sleep(0.5);
}
