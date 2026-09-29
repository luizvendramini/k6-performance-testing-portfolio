import { check } from 'k6';
import type { Options } from 'k6/options';
import { browser } from 'k6/browser';
import { baseUrl, token } from '../../config/index.ts';

export const options: Options = {
  scenarios: {
    quickpizza_browser: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 2,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    browser_web_vital_lcp: ['p(95)<4000'],
  },
};

export default async function (): Promise<void> {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ Authorization: `Token ${token}` });
    await page.goto(`${baseUrl}/`);
    const title = await page.title();
    check(title, { 'título da página identifica QuickPizza': (value) => /quickpizza/i.test(value) });

    const action = page.locator('button[name="pizza-please"]');
    check(await action.isVisible(), { 'ação Pizza, Please está visível': (visible) => visible });
    await action.click();

    const recommendation = page.locator('#pizza-name');
    await recommendation.waitFor({ state: 'visible', timeout: 15000 });
    const name = await recommendation.textContent();
    check(name, { 'a página mostra uma recomendação de pizza': (value) => Boolean(value?.trim()) });
  } finally {
    await page.close();
  }
}
