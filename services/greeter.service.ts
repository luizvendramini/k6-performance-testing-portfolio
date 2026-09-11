/**
 * services/greeter.service.ts
 *
 * "Service Object" para o servico gRPC (mock-services/grpc). O modulo
 * `k6/net/grpc` e nativo do k6 (nao exige nenhuma dependencia npm no lado
 * do teste - so o mock-service, do lado servidor, usa @grpc/grpc-js).
 *
 * Assim como em services/products.service.ts, o objetivo e centralizar o
 * "como falar com o servico" (caminho do .proto, endereco, nome
 * qualificado dos metodos) para que o spec de teste (tests/grpc/greeter.spec.ts)
 * foque apenas no cenario de carga.
 */
import grpc from 'k6/net/grpc';
import { check } from 'k6';
import { env } from '../config/index.ts';

export const client = new grpc.Client();

// Import path = diretorio onde o .proto vive; o arquivo e resolvido dentro dele.
client.load(['../../mock-services/grpc'], 'greeter.proto');

const SAY_HELLO_METHOD = 'greeter.Greeter/SayHello';
const SAY_HELLO_STREAM_METHOD = 'greeter.Greeter/SayHelloStream';

export function connectGrpc(): void {
  client.connect(env.grpcAddr, { plaintext: true });
}

export function closeGrpc(): void {
  client.close();
}

export function sayHello(name: string): ReturnType<typeof client.invoke> {
  return client.invoke(SAY_HELLO_METHOD, { name });
}

export function checkSayHelloResponse(response: ReturnType<typeof client.invoke>, expectedName: string): boolean {
  return check(response, {
    'gRPC SayHello -> status OK': (r) => r !== null && r.status === grpc.StatusOK,
    'gRPC SayHello -> mensagem contem o nome enviado': (r) => {
      const message = (r?.message as { message?: string } | undefined)?.message;
      return typeof message === 'string' && message.includes(expectedName);
    },
  });
}

export const sayHelloStreamMethod = SAY_HELLO_STREAM_METHOD;
