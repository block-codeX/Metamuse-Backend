import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { functionAuth } from 'src/auth/auth.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { Socket } from 'socket.io';
import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
// @ts-ignore
import * as utils from 'y-websocket/bin/utils';
import { RedisPersistence } from 'y-redis';

interface ClientInfo {
  client: WebSocket;
  userId: string | null;
  projectId: string | null;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
@Injectable()
export class YjsWebSocketGateway implements OnGatewayConnection {
  private readonly logger = new ConsoleLogger(YjsWebSocketGateway.name);
  private persistence: any
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @Inject('REDIS_CONFIG') private readonly redisConfig: any,
  ) {
  }

  async handleConnection(client: any, request: Request) {
    try {
      const newUrl = new URL(request.url, 'http://localhost');
      const params = newUrl.searchParams;
      const token = params.get('token');
      const projectId = params.get('projectId');
      client.handshake = { query: { token } };
      client.docName = projectId;
      await functionAuth(
        client,
        this.jwtService,  
        this.authService,
        this.usersService,
      );
      this.persistence = new RedisPersistence(this.redisConfig);
      this.persistence.writeState = async () => {}
      utils.setPersistence(this.persistence);
      utils.setupWSConnection(client, request, {
        docName: projectId,
        gc: true,
      });
    } catch (error) {
      console.error(error);
      this.logger.error(`Connection error: ${error.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, error.message);
      }
    }
  }
    handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

}
