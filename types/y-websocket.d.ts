declare module 'y-websocket/bin/utils.cjs' {
    import { WebSocketServer } from 'ws';
    export function setupWSConnection(
      conn: WebSocket,
      req: any,
      options?: { gc?: boolean }
    ): void;
  }