/**
 * services/products.service.ts
 *
 * "Service Object": o equivalente, em testes de protocolo/carga, ao Page
 * Object Model usado nos portfolios de Playwright e WebdriverIO. A ideia e
 * a mesma - isolar COMO se fala com o sistema (endpoints, headers, parsing
 * de resposta) de O QUE cada teste quer provar (cenarios, thresholds).
 *
 * Cada spec de teste (smoke/load/stress/spike/soak) importa estas funcoes
 * em vez de montar `http.get`/`http.post` cru: se o contrato da API mudar
 * (uma rota, um header), o ajuste e feito em UM lugar so, e todos os testes
 * continuam validos - exatamente o ganho de reuso e manutenibilidade que um
 * Page Object da para testes de UI.
 */
import http from 'k6/http';
import type { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { env } from '../config/index.ts';

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

export interface NewProduct {
  name: string;
  category: string;
  price: number;
}

const BASE_URL = env.httpBaseUrl;

/**
 * Toda chamada usa a tag `endpoint`, o que permite definir thresholds por
 * rota (ver config/index.ts, `http_req_duration{endpoint:search}`) sem
 * precisar de um script por rota.
 */
function tags(endpoint: string): { tags: { endpoint: string } } {
  return { tags: { endpoint } };
}

class ProductsService {
  health(): RefinedResponse<ResponseType | undefined> { 
    return http.get(`${BASE_URL}/api/health`, tags('health'));
  }

  list(): RefinedResponse<ResponseType | undefined> { 
    return http.get(`${BASE_URL}/api/products`, tags('list'));
  }

  getById(id: number): RefinedResponse<ResponseType | undefined> {
    return http.get(`${BASE_URL}/api/products/${id}`, tags('get-by-id'));
  }

  search(term: string): RefinedResponse<ResponseType | undefined> {
    return http.get(`${BASE_URL}/api/products/search?q=${encodeURIComponent(term)}`, tags('search'));
  }

  create(product: NewProduct): RefinedResponse<ResponseType | undefined> { 
    return http.post(`${BASE_URL}/api/products`, JSON.stringify(product), {
      headers: { 'Content-Type': 'application/json' },
      ...tags('create'),
    });
  }

  update(id: number, patch: Partial<NewProduct>): RefinedResponse<ResponseType | undefined> { 
    return http.put(`${BASE_URL}/api/products/${id}`, JSON.stringify(patch), {
      headers: { 'Content-Type': 'application/json' },
      ...tags('update'),
    });
  }

  remove(id: number): RefinedResponse<ResponseType | undefined> {
    return http.del(`${BASE_URL}/api/products/${id}`, null, tags('delete'));
  }

  /** Usado no teardown() dos testes que criam produtos, para nao "sujar" execucoes futuras. */
  reset(): RefinedResponse<ResponseType | undefined> {
    return http.post(`${BASE_URL}/api/products/reset`, null, tags('reset'));
  }
}

export const productsService = new ProductsService();

// ---------------------------------------------------------------------------
// Checks reutilizaveis
//
// Centralizar os `check()` aqui (em vez de repeti-lo em cada spec) evita
// divergencia sutil entre testes (ex: um teste checando `status === 200` e
// outro esquecendo de checar o corpo da resposta).
// ---------------------------------------------------------------------------
export function checkListResponse(res: RefinedResponse<ResponseType | undefined>): boolean {
  return check(res, {
    'GET /api/products -> status 200': (r) => r.status === 200,
    'GET /api/products -> corpo e um array': (r) => Array.isArray(r.json()),
  });
}

export function checkProductResponse(res: RefinedResponse<ResponseType | undefined>): boolean {
  return check(res, {
    'produto -> status 200': (r) => r.status === 200,
    'produto -> possui id': (r) => {
      const body = r.json() as { id?: number } | null;
      return !!body && typeof body.id === 'number';
    },
  });
}

export function checkCreateResponse(res: RefinedResponse<ResponseType | undefined>): boolean {
  return check(res, {
    'POST /api/products -> status 201': (r) => r.status === 201,
    'POST /api/products -> retorna id gerado': (r) => {
      const body = r.json() as { id?: number } | null;
      return !!body && typeof body.id === 'number';
    },
  });
}

export function checkSearchResponse(res: RefinedResponse<ResponseType | undefined>): boolean {
  return check(res, {
    'GET /api/products/search -> status 200': (r) => r.status === 200,
    'GET /api/products/search -> corpo e um array': (r) => Array.isArray(r.json()),
  });
}
