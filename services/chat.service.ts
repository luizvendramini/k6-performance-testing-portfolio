/**
 * services/chat.service.ts
 *
 * "Service Object" para o protocolo WebSocket - mesma ideia de
 * services/products.service.ts (encapsular URL e formato de mensagem em um
 * unico lugar), adaptada ao estilo de callback que o modulo `k6/ws` exige
 * (a conexao inteira vive dentro de uma funcao de callback, entao nao da
 * para expor metodos como `.send()`/`.get()` de forma assíncrona comum -
 * o que se reaproveita aqui e a URL de conexao e o formato do protocolo).
 */
import ws from 'k6/ws';
import type { Socket } from 'k6/ws';
import { env } from '../config/index.ts';

export interface ChatMessage {
  type: 'welcome' | 'echo' | 'ping' | 'error';
  text?: string;
  at?: number;
  receivedAt?: number;
  reason?: string;
}

const CHAT_WS_URL = env.wsUrl;

export function connectChat(handler: (socket: Socket) => void): ReturnType<typeof ws.connect> {
  return ws.connect(CHAT_WS_URL, {}, handler);
}

export function buildMessagePayload(text: string): string {
  return JSON.stringify({ type: 'message', text });
}

export function parseChatMessage(raw: string): ChatMessage {
  return JSON.parse(raw) as ChatMessage;
}
