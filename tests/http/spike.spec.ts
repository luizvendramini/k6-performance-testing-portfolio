import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { requireHeavyTestOptIn, thresholds } from '../../config/index.ts';
import { checkRecommendation, recommendPizza } from '../../services/quickpizza.service.ts';

requireHeavyTestOptIn();

export const options: Options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 5 },
        { duration: '5s', target: 25 },
        { duration: '15s', target: 25 },
        { duration: '5s', target: 5 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: thresholds.spike,
};

export default function (): void {
  checkRecommendation(recommendPizza());
  sleep(0.3);
}
