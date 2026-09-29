/** QuickPizza real environment configuration. */
const configuredBaseUrl = __ENV.BASE_URL || 'https://quickpizza.grafana.com';
export const baseUrl = configuredBaseUrl.replace(/\/$/, '');

// This is the public practice token documented by Grafana for QuickPizza.
// Override it with -e TOKEN=... when targeting a different environment.
export const token = __ENV.TOKEN || 'abcdef0123456789';

export const pizzaPayload = {
  maxCaloriesPerSlice: 800,
  mustBeVegetarian: true,
  excludedIngredients: ['anchovies', 'bacon'],
  excludedTools: [],
  maxNumberOfToppings: 4,
  minNumberOfToppings: 2,
};

export function requireHeavyTestOptIn(): void {
  if (__ENV.ALLOW_HEAVY_TESTS !== 'true') {
    throw new Error(
      'Este perfil gera carga elevada. Defina ALLOW_HEAVY_TESTS=true e use apenas um ambiente seu ou local.',
    );
  }
}

export const thresholds = {
  smoke: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
  load: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    checks: ['rate>0.99'],
  },
  stress: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<10000'],
    checks: ['rate>0.90'],
  },
  spike: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<10000'],
    checks: ['rate>0.90'],
  },
  soak: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.98'],
  },
};
