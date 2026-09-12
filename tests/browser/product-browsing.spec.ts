/**
 * tests/browser/product-browsing.spec.ts
 *
 * Teste de carga com o modulo `k6/browser`: em vez de bater direto na API,
 * abre navegadores reais (Chromium, headless) e navega pela pagina como um
 * usuario navegaria - renderizacao, JavaScript client-side e Web Vitals
 * inclusos. E o nivel de teste mais "caro" (cada VU sobe um navegador
 * inteiro), por isso o numero de VUs e bem menor que nos testes de
 * protocolo puro: aqui o objetivo e validar a experiencia sob alguma
 * concorrencia real de usuarios, nao encontrar o limite de throughput.
 *
 * Roda apenas no workflow de load-suite (nao no smoke de todo push), pois
 * depende de Chromium instalado no runner - ver .github/workflows/load-suite.yml.
 */
import { check } from 'k6';
import type { Options } from 'k6/options';
import { browser } from 'k6/browser';
import StorePage from '../../services/store.page.ts';

export const options: Options = {
  scenarios: {
    'product-browsing': {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 15,
      options: {
        browser: { type: 'chromium' },
      },
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    browser_web_vital_lcp: ['p(95)<2000'], // Largest Contentful Paint - percepcao de "carregou"
  },
};

export default async function (): Promise<void> {
  const page = await browser.newPage();
  const storePage = new StorePage(page);

  try {
    await storePage.open();

    const title = await storePage.title();
    check(title, { "titulo da pagina e 'Catalogo de produtos'": (t) => t === 'Catalogo de produtos' });

    await storePage.search('mouse');
    const resultCount = await storePage.resultCount();
    check(resultCount, { 'busca por "mouse" retorna ao menos 1 produto': (n) => n >= 1 });
  } finally {
    await page.close();
  }
}
