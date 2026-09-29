import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, pizzaPayload, token } from '../config/index.ts';

export interface PizzaRecommendation {
  pizza?: {
    id?: number;
    name?: string;
    dough?: { name?: string };
    ingredients?: { name?: string }[];
    tool?: string;
  };
  calories?: number;
  vegetarian?: boolean;
}

export function openHome() {
  return http.get(`${baseUrl}/`, { tags: { endpoint: 'home' } });
}

export function getQuotes() {
  return http.get(`${baseUrl}/api/quotes`, { tags: { endpoint: 'quotes' } });
}

export function recommendPizza() {
  return http.post(`${baseUrl}/api/pizza`, JSON.stringify(pizzaPayload), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    tags: { endpoint: 'pizza-recommendation' },
  });
}

export function checkHome(response: ReturnType<typeof openHome>): void {
  check(response, {
    'página inicial retorna HTTP 200': (res) => res.status === 200,
    'página inicial contém QuickPizza': (res) => String(res.body).toLowerCase().includes('quickpizza'),
  });
}

export function checkQuotes(response: ReturnType<typeof getQuotes>): void {
  check(response, {
    'API de citações retorna HTTP 200': (res) => res.status === 200,
    'API de citações retorna itens': (res) => {
      try {
        const body = res.json() as { quotes?: unknown[] };
        return Array.isArray(body.quotes) && body.quotes.length > 0;
      } catch {
        return false;
      }
    },
  });
}

export function checkRecommendation(response: ReturnType<typeof recommendPizza>): void {
  check(response, {
    'recomendação retorna HTTP 200': (res) => res.status === 200,
    'resposta contém pizza, massa e ingredientes': (res) => {
      try {
        const body = res.json() as PizzaRecommendation;
        return Boolean(
          body.pizza?.name &&
            body.pizza.dough?.name &&
            Array.isArray(body.pizza.ingredients) &&
            body.pizza.ingredients.length > 0,
        );
      } catch {
        return false;
      }
    },
    'recomendação respeita restrição vegetariana': (res) => {
      try {
        const body = res.json() as PizzaRecommendation;
        return body.vegetarian === true;
      } catch {
        return false;
      }
    },
  });
}
