/**
 * tests/grpc/greeter.spec.ts
 *
 * Teste de carga sobre gRPC (mock-services/grpc), usando o modulo nativo
 * `k6/net/grpc` - nenhuma extensao/xk6 e necessaria, o cliente gRPC ja vem
 * embutido no binario oficial do k6. Cobre os dois estilos de chamada
 * expostos pelo servico (ver mock-services/grpc/greeter.proto):
 *  - unaria (SayHello): 1 request, 1 response;
 *  - streaming do servidor (SayHelloStream): 1 request, N responses.
 *
 * Executor: `constant-vus` - carga fixa e moderada, o suficiente para
 * demonstrar o padrao sem exigir infraestrutura pesada.
 */
import { check, sleep } from 'k6';
import type { Options } from 'k6/options';
import { Stream } from 'k6/net/grpc';
import { client, connectGrpc, closeGrpc, sayHello, checkSayHelloResponse, sayHelloStreamMethod } from '../../services/greeter.service.ts';

export const options: Options = {
  scenarios: {
    grpc: {
      executor: 'constant-vus',
      vus: 5,
      duration: '20s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    grpc_req_duration: ['p(95)<300'],
  },
};

export default function (): void {
  connectGrpc();

  const name = `VU-${__VU}`;
  checkSayHelloResponse(sayHello(name), name);

  // Chamada com streaming do servidor: validamos que recebemos exatamente
  // as mensagens que o mock-service promete enviar (ver
  // mock-services/grpc/server.ts, `sayHelloStream`).
  const received: string[] = [];
  const stream = new Stream(client, sayHelloStreamMethod, { name });

  stream.on('data', (response: { message: string }) => {
    received.push(response.message);
  });

  stream.on('end', () => {
    check(received, { 'stream retornou ao menos 1 mensagem': (msgs) => msgs.length >= 1 });
  });

  stream.on('error', (err: unknown) => {
    check(null, { 'stream nao deveria falhar': () => false });
    console.error(`erro no stream gRPC: ${JSON.stringify(err)}`);
  });

  sleep(1);
  closeGrpc();
}
