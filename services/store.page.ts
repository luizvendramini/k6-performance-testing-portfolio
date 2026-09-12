/**
 * services/store.page.ts
 *
 * Page Object da pagina /store, usado pelo teste de carga com o modulo
 * `k6/browser`. A API do k6 browser e deliberadamente compativel com a do
 * Playwright (locators, `.fill()`, `.click()`), entao aqui o Page Object
 * Model se aplica da forma mais literal possivel - o mesmo padrao usado no
 * portfolio de Playwright, agora sob carga real de multiplos navegadores
 * simultaneos em vez de uma unica sessao funcional.
 */
import type { Page } from 'k6/browser';
import { env } from '../config/index.ts';

class StorePage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open(): Promise<void> {
    await this.page.goto(`${env.httpBaseUrl}/store`);
  }

  async title(): Promise<string | null> {
    return this.page.locator('h1').textContent();
  }

  async search(term: string): Promise<void> {
    await this.page.locator('[data-testid="search-input"]').fill(term);
    await this.page.locator('[data-testid="search-button"]').click();
    // O resultado da busca chega via fetch() assincrono no client-side;
    // aguardamos a lista de produtos ser re-renderizada antes de seguir.
    await this.page.waitForTimeout(300);
  }

  async resultCount(): Promise<number> {
    return this.page.locator('[data-testid="product-list"] li').count();
  }
}

export default StorePage;
