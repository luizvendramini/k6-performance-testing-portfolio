import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { requireHeavyTestOptIn, thresholds } from '../../config/index.ts';
import { checkRecommendation, recommendPizza } from '../../services/quickpizza.service.ts';

requireHeavyTestOptIn();

export const options: Options = {
  scenarios: {
    soak: { executor: 'constant-vus', vus: 5, duration: '5m' },
  },
  thresholds: thresholds.soak,
};

export default function (): void {
  checkRecommendation(recommendPizza());
  sleep(1);
}
