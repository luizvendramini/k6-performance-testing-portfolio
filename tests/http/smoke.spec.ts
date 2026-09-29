import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { thresholds } from '../../config/index.ts';
import { checkHome, checkQuotes, checkRecommendation, getQuotes, openHome, recommendPizza } from '../../services/quickpizza.service.ts';

export const options: Options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '10s' },
  },
  thresholds: thresholds.smoke,
};

export default function (): void {
  checkHome(openHome());
  checkQuotes(getQuotes());
  checkRecommendation(recommendPizza());
  sleep(1);
}
