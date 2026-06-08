import { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { Readable } from 'node:stream';
import type { Socket } from 'node:net';

type MockSocket = PassThrough & {
  writable: boolean;
  readable: boolean;
  destroyed: boolean;
};

function createMockSocket(): MockSocket {
  const stream = new PassThrough() as MockSocket;
  stream.writable = true;
  stream.readable = true;
  stream.destroyed = false;
  return stream;
}

function asNodeSocket(stream: MockSocket): Socket {
  return stream as unknown as Socket;
}

export function createSSEBridge() {
  const socket = createMockSocket();
  const incoming = new IncomingMessage(asNodeSocket(socket));
  const outgoing = new ServerResponse(incoming);

  outgoing.assignSocket(asNodeSocket(socket));

  const webStream = Readable.toWeb(socket) as ReadableStream<Uint8Array>;

  return { incoming, outgoing, webStream };
}

export async function requestToIncomingMessage(
  request: Request,
  parsedBody?: unknown,
): Promise<IncomingMessage> {
  const url = new URL(request.url);
  const socket = createMockSocket();
  const incoming = new IncomingMessage(asNodeSocket(socket));

  incoming.method = request.method;
  incoming.url = `${url.pathname}${url.search}`;
  incoming.headers = Object.fromEntries(request.headers.entries());

  if (parsedBody !== undefined) {
    const payload = Buffer.from(
      typeof parsedBody === 'string'
        ? parsedBody
        : JSON.stringify(parsedBody),
    );
    incoming.push(payload);
    incoming.push(null);
    return incoming;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const payload = Buffer.from(await request.arrayBuffer());
    if (payload.length > 0) {
      incoming.push(payload);
    }
  }

  incoming.push(null);
  return incoming;
}

export class NodeResponseCollector {
  readonly incoming: IncomingMessage;
  readonly outgoing: ServerResponse;
  readonly response: Promise<Response>;

  private chunks: Buffer[] = [];
  private statusCode = 200;
  private headers: Record<string, string> = {};
  private settled = false;
  private resolve!: (response: Response) => void;

  constructor() {
    this.response = new Promise<Response>((resolve) => {
      this.resolve = resolve;
    });

    const socket = createMockSocket();
    this.incoming = new IncomingMessage(asNodeSocket(socket));
    this.outgoing = new ServerResponse(this.incoming);
    this.outgoing.assignSocket(asNodeSocket(socket));
    this.patchOutgoing();
  }

  private finish(bodyChunk?: string | Buffer) {
    if (bodyChunk) {
      this.chunks.push(
        Buffer.isBuffer(bodyChunk) ? bodyChunk : Buffer.from(bodyChunk),
      );
    }

    if (this.settled) {
      return;
    }

    this.settled = true;
    const body = Buffer.concat(this.chunks);

    this.resolve(
      new Response(body.length > 0 ? body : null, {
        status: this.statusCode,
        headers: this.headers,
      }),
    );
  }

  private patchOutgoing() {
    const outgoing = this.outgoing;

    outgoing.writeHead = ((
      statusCode: number,
      statusMessageOrHeaders?: string | NodeJS.Dict<string | string[] | number>,
      headers?: NodeJS.Dict<string | string[] | number>,
    ) => {
      this.statusCode = statusCode;

      const headerRecord =
        typeof statusMessageOrHeaders === 'object' && statusMessageOrHeaders
          ? statusMessageOrHeaders
          : headers;

      if (headerRecord) {
        for (const [key, value] of Object.entries(headerRecord)) {
          if (value === undefined) {
            continue;
          }

          this.headers[key.toLowerCase()] = Array.isArray(value)
            ? value.map(String).join(', ')
            : String(value);
        }
      }

      return outgoing;
    }) as typeof outgoing.writeHead;

    outgoing.write = ((chunk: string | Buffer) => {
      this.chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
      );
      return true;
    }) as typeof outgoing.write;

    outgoing.end = ((chunk?: string | Buffer) => {
      this.finish(chunk);
      return outgoing;
    }) as typeof outgoing.end;
  }
}
