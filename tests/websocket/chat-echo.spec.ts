/**
 * tests/websocket/chat-echo.spec.ts
 *
 * Teste de carga sobre WebSocket: N "usuarios" conectam simultaneamente na
 * sala de chat, enviam uma mensagem e validam o eco do servidor - o
 * equivalente, em protocolo full-duplex, ao que um load test faz sobre
 * HTTP. Demonstra que o k6 testa muito alem de request/response.
 *
 * Executor: `constant-vus` - cada VU abre 1 conexao WebSocket e a mantem
 * durante toda a iteracao (conexoes persistentes, nao "uma por request").
 */
import { check, sleep } from 'k6';
import type { Options } from 'k6/options';
import type { Socket } from 'k6/ws';
import { connectChat, buildMessagePayload, parseChatMessage } from '../../services/chat.service.ts';

export const options: Options = {
  scenarios: {
    'websocket-chat': {
      executor: 'constant-vus',
      vus: 15,
      duration: '20s',
    },
  },
  thresholds: {
    // Metrica nativa do k6 para sessoes WebSocket: tempo ate a conexao
    // (handshake) ser concluida.
    ws_connecting: ['p(95)<200'],
    checks: ['rate>0.99'],
  },
};

export default function (): void {
  const messageText = `ola do VU ${__VU}, iteracao ${__ITER}`;

  const res = connectChat((socket: Socket) => {
    let receivedWelcome = false;
    let receivedEcho = false;

    socket.on('open', () => {
      socket.send(buildMessagePayload(messageText));
    });

    socket.on('message', (raw: string) => {
      const message = parseChatMessage(raw);

      if (message.type === 'welcome') {
        receivedWelcome = true;
      }
      if (message.type === 'echo' && message.text === messageText) {
        receivedEcho = true;
        socket.close();
      }
    });

    socket.on('close', () => {
      check(null, {
        'recebeu mensagem de boas-vindas': () => receivedWelcome,
        'recebeu o eco da propria mensagem': () => receivedEcho,
      });
    });

    // Failsafe: se, por qualquer motivo, o servidor nao responder, a
    // conexao nao fica presa ate o timeout global do k6 - falha rapido e
    // com um check claro em vez de travar a VU.
    socket.setTimeout(() => socket.close(), 5_000);
  });

  check(res, { 'handshake HTTP -> WebSocket concluido (status 101)': (r) => r !== null && r.status === 101 });

  sleep(1);
}
