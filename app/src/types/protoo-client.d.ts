// src/types/protoo-client.d.ts

declare module 'protoo-client' {
  export class WebSocketTransport {
    constructor(url: string);
  }

  export class Peer {
    constructor(transport: WebSocketTransport);

    on(
      event: 'open' | 'close' | 'disconnected' | 'failed' | 'request' | 'notification',
      callback: (...args: any[]) => void
    ): void;

    request(method: string, data?: any): Promise<any>;
    close(): void;
  }
}
