/**
 * mock-services/grpc/server.ts
 *
 * Servidor gRPC local minimo (Node + @grpc/grpc-js), alvo do teste de carga
 * em tests/grpc/greeter.spec.ts. Mesmo racional do mock-services/server.ts:
 * determinismo e zero dependencia de rede externa em CI.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, 'greeter.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const greeterProto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  greeter: { Greeter: grpc.ServiceClientConstructor };
};

function sayHello(
  call: grpc.ServerUnaryCall<{ name: string }, { message: string }>,
  callback: grpc.sendUnaryData<{ message: string }>
): void {
  const name = call.request.name || 'mundo';
  callback(null, { message: `Ola, ${name}!` });
}

function sayHelloStream(call: grpc.ServerWritableStream<{ name: string }, { message: string }>): void {
  const name = call.request.name || 'mundo';
  const total = 5;
  let sent = 0;

  const interval = setInterval(() => {
    sent += 1;
    call.write({ message: `Ola, ${name}! (mensagem ${sent}/${total})` });
    if (sent >= total) {
      clearInterval(interval);
      call.end();
    }
  }, 50);
}

const server = new grpc.Server();
server.addService(greeterProto.greeter.Greeter.service, { sayHello, sayHelloStream });

const PORT = Number(process.env.GRPC_PORT) || 50051;
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), () => {
  console.log(`mock-services/grpc/server.ts rodando em 0.0.0.0:${PORT}`);
});
