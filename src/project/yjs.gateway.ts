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
import { ConsoleLogger, Injectable, Logger } from '@nestjs/common';
import { CRDTService } from './project.service';
import { Types } from 'mongoose';
import * as Y from 'yjs';
import { Server, WebSocket } from 'ws';
import * as utils from 'y-websocket/bin/utils';

interface ClientInfo {
  client: WebSocket;
  userId: string | null;
  projectId: string | null;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
@Injectable()
export class YjsWebSocketGateway
  implements OnGatewayConnection
{
  private readonly logger = new ConsoleLogger(YjsWebSocketGateway.name);
  @WebSocketServer()
  server: Server;
  constructor(
    private readonly crdtService: CRDTService,
    private readonly usersService: UsersService,
    private readonly projectService: ProjectService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
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
      const doc = utils.setupWSConnection(client, request, {
        docName: projectId,
        gc: true,
        loader: this.getOrCreateDoc.bind(this),
        saver: this.crdtService.saveToMongoDB.bind(this.crdtService), // Bind the correct context
      });
      // const initialState = Y.encodeStateAsUpdate(doc);

    } catch (error) {
      console.error(error);
      client.close();
    }
  }
  @SubscribeMessage("project:init")
  async handleProjectInit(client: Socket,) {
      // // Send initial data to the joining user
      // client.emit('project:init', {
      //   update: Array.from(initialState),
      // });
    this.logger.log(`Client joined room:`); 
  }

  // Handle client disconnection
  // handleDisconnect(client: Socket) {
  //   this.logger.log(`Client disconnected: ${client.id}`);
  // }
  async getOrCreateDoc(roomName: string, client, doc): Promise<Y.Doc> {
    const project = await this.projectService.findOne(
      new Types.ObjectId(roomName),
    );
    const hasAccess = project.collaborators.some(
      (collaborator) => collaborator.toString() === client.user._id?.toString(),
    );
    if (!hasAccess) {
      throw new Error('Access denied');
    }
    // Load document data into the Y.Doc
    await this.crdtService.getDocument(roomName, doc);
    const initialObjects = doc.getMap('objects').toJSON();
    const initialCanvasSettings = doc.getMap('canvas').toJSON();
    client.send(JSON.stringify({
      type: 'initial-state',
      data: {
        objects: initialObjects,
        canvas: initialCanvasSettings,
      },
    }));
    this.logger.log(`Loaded document form db ${roomName}`);
    return doc;
  }
}
