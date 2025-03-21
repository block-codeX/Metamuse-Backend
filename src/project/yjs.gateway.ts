import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ProjectService } from './project.service';
import { AuthWsMiddleware, functionAuth } from 'src/auth/auth.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { Socket } from 'socket.io';
import * as http from 'http';
import { ConsoleLogger, Inject, Injectable, Logger } from '@nestjs/common';
import { CRDTService } from './project.service';
import { Types } from 'mongoose';
import * as Y from 'yjs';
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
  @WebSocketServer()
  server: Server;
  constructor(
    private readonly crdtService: CRDTService,
    private readonly usersService: UsersService,
    private readonly projectService: ProjectService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @Inject('REDIS_CONFIG') private readonly redisConfig: any,
  ) {}

  async handleConnection(client: WebSocket, request: Request) {
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
      const persistence = new RedisPersistence(this.redisConfig);
      utils.setPersistence(persistence);
      utils.setupWSConnection(client, request, {
        docName: projectId,
        gc: true,
        persistence,
      });
    } catch (error) {
      console.error(error);
      this.logger.error(`Connection error: ${error.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, error.message);
      }
    }
  }
  

  // Handle client disconnection
  // handleDisconnect(client: Socket) {
  //   this.logger.log(`Client disconnected: ${client.id}`);
  // }

}
