/**
 * mock-services/lib/minimal-ws.ts
 *
 * Implementacao minima do protocolo WebSocket (RFC 6455) usando apenas
 * modulos nativos do Node.js (`http`, `crypto`, `stream`) - sem depender do
 * pacote `ws`.
 *
 * Por que implementar isso "na mao" em vez de usar uma lib?
 * Este projeto e um portfolio de testes, e o mock-services e propositalmente
 * mantido sem dependencias de runtime (mesma decisao ja tomada no
 * mock-services/server.ts para a parte HTTP). Um servidor de eco/chat so
 * precisa de handshake + frames de texto, entao o custo de manter esse
 * "micro-driver" e baixo e o ganho e zero superficie extra de dependencias
 * de terceiros para o alvo dos testes de carga.
 *
 * Suporta o suficiente para o cenario de tests/websocket/chat-echo.spec.ts:
 * handshake HTTP -> 101, frames de texto (recebendo e enviando) e frame de
 * close. Nao implementa fragmentacao nem extensoes (permessage-deflate) -
 * desnecessario para um echo/chat de mensagens curtas.
 */
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import crypto from 'crypto';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface MinimalWsConnection {
  send(payload: unknown): void;
  close(): void;
  onMessage(handler: (text: string) => void): void;
  onClose(handler: () => void): void;
}

function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;

  let header: Buffer;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Decodifica um unico frame de texto (nao-fragmentado) enviado pelo cliente (sempre mascarado, conforme o protocolo). */
function decodeClientFrame(buffer: Buffer): { opcode: number; text: string } | null {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let payloadLength = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  if (!masked) {
    // Clientes conformes ao RFC sempre mascaram; um frame sem mascara aqui
    // e tratado como invalido em vez de lido como texto puro.
    return { opcode, text: '' };
  }

  const maskKey = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = buffer.subarray(offset, offset + payloadLength);
  const unmasked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    unmasked[i] = payload[i] ^ maskKey[i % 4];
  }

  return { opcode, text: unmasked.toString('utf8') };
}

/**
 * Faz o upgrade de uma requisicao HTTP para WebSocket. Retorna `null`
 * (e encerra a conexao) se a requisicao nao for um handshake valido.
 */
export function upgradeToWebSocket(req: IncomingMessage, socket: Socket): MinimalWsConnection | null {
  const key = req.headers['sec-websocket-key'];
  if (!key || Array.isArray(key)) {
    socket.destroy();
    return null;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + WS_MAGIC_GUID)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  let messageHandler: (text: string) => void = () => {};
  let closeHandler: () => void = () => {};

  socket.on('data', (chunk: Buffer) => {
    const frame = decodeClientFrame(chunk);
    if (!frame) return;

    if (frame.opcode === 0x8) {
      // close frame
      socket.end();
      return;
    }
    if (frame.opcode === 0x1) {
      // text frame
      messageHandler(frame.text);
    }
    // ping (0x9) / pong (0xA) sao ignorados de proposito: o echo/chat deste
    // portfolio nao depende de keep-alive nesse nivel.
  });

  socket.on('close', () => closeHandler());
  socket.on('error', () => closeHandler());

  return {
    send(payload: unknown): void {
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!socket.destroyed) socket.write(encodeTextFrame(text));
    },
    close(): void {
      if (!socket.destroyed) socket.end();
    },
    onMessage(handler: (text: string) => void): void {
      messageHandler = handler;
    },
    onClose(handler: () => void): void {
      closeHandler = handler;
    },
  };
}

export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  return (req.headers.upgrade ?? '').toLowerCase() === 'websocket';
}
