import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
import { CORS_ALLOWED } from '@app/utils';

interface CustomWebsocket extends WebSocket {
  handshake: any
  query: any
  docName: any
}
interface ClientInfo {
  client: CustomWebsocket;
  userId: string;
  projectId: string;
  user: any; // Add user object for additional user data if needed
}


interface CommandPayload {
  type: string;
  payload: any;
  [key: string]: any;
}

@WebSocketGateway({
  cors: { origin: CORS_ALLOWED },
  path: "/yjs"

})
@Injectable()
export class YjsWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {//}, OnGatewayInit {
  private readonly logger = new ConsoleLogger(YjsWebSocketGateway.name);
  private persistence: any;
  private rooms: Map<string, Map<string, ClientInfo>> = new Map();
  
  @WebSocketServer()
  server: Server;
  
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @Inject('REDIS_CONFIG') private readonly redisConfig: any,
  ) {}
  
  // afterInit(server: Server) {

  // }
  
  async handleConnection(client: CustomWebsocket & { docName?: string, user?: any }, request: Request) {
    try {
      const newUrl = new URL(request.url, 'http://localhost/yjs');
      const params = newUrl.searchParams;
      const token = params.get('token');
      const projectId = params.get('projectId');
      const isCommand = params.get('command') === 'true';
      // const 
      
      // Simulate handshake for auth middleware
      client.handshake = { query: { token } };
      client.docName = projectId;
      
      // Authenticate the client
      await functionAuth(
        client,
        this.jwtService,
        this.authService,
        this.usersService,
      );
      
      // If this is a command connection, set up for commands rather than YJS sync
      if (isCommand) {
        this.setupCommandConnection(client, (projectId as string));
      } else {
        // Regular YJS connection
        this.logger.log('YJS WebSocket Gateway initialized');
        this.persistence = new RedisPersistence(this.redisConfig);
        this.persistence.writeState = async () => {}; // Override writeState if needed
        utils.setPersistence(this.persistence);
        utils.setupWSConnection(client, request, {
          docName: projectId,
          gc: true,
        });
      }
      
      // Add client to room
      this.addClientToRoom(client, (projectId as string));
      
      // Send connection acknowledgment for command clients
      if (isCommand) {
        this.sendToClient(client, {
          type: 'command',
          command: 'connected',
          payload: {
            userId: client.user?.id,
            projectId,
            timestamp: Date.now()
          }
        });
        
      }
      
      this.logger.log(`Client connected: ${client.user?.id} to project: ${projectId}`);
    } catch (error) {
      console.error(error);
      this.logger.error(`Connection error: ${error.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, error.message);
      }
    }
  }
  
  handleDisconnect(client: WebSocket & { docName?: string, user?: any }) {
    const projectId = client.docName;
    const userId = client.user?.id;
    if (projectId && userId) {
      // Remove client from room
      this.removeClientFromRoom(client, projectId);     
      this.logger.log(`Client disconnected: ${userId} from project: ${projectId}`);
    }
  }
  
  private setupCommandConnection(client: WebSocket & { user?: any }, projectId: string) {
    // Set up message handler for command connections
    client.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("messafgge", data)
        if (data.type === 'command') {
          // Process the command by broadcasting it to others in the room
          this.command(client, projectId, data);
        }
      } catch (err) {
        this.logger.error(`Error processing message: ${err.message}`);
      }
    });
  }
  
  /**
   * Add a client to a room
   */
  private addClientToRoom(client: CustomWebsocket & { user?: any }, projectId: string) {
    if (!this.rooms.has(projectId)) {
      this.rooms.set(projectId, new Map());
    }
    
    const room = this.rooms.get(projectId);
    const userId = client.user?.id;
    
    if (userId && room) {
      room.set(userId, { 
        client, 
        userId, 
        projectId,
        user: client.user
      });
      
      this.logger.debug(`Added client ${userId} to room ${projectId}. Room size: ${room.size}`);
    }
  }
  
  /**
   * Remove a client from a room
   */
  private removeClientFromRoom(client: WebSocket & { user?: any }, projectId: string) {
    const room = this.rooms.get(projectId);
    const userId = client.user?.id;
    
    if (room && userId) {
      room.delete(userId);
      this.logger.debug(`Removed client ${userId} from room ${projectId}. Room size: ${room.size}`);
      
      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(projectId);
        this.logger.debug(`Removed empty room ${projectId}`);
      }
    }
  }
  
  /**
   * Send a command to all clients in a room except the sender
   * @param sender The client sending the command (to be excluded from broadcast)
   * @param projectId The project/room ID
   * @param commandData The command data to send
   */
  command(sender: WebSocket & { user?: any }, projectId: string, commandData: CommandPayload) {
    const room = this.rooms.get(projectId);
    const senderId = sender.user?.id;
    
    if (!room) {
      this.logger.warn(`Attempted to send command to non-existent room: ${projectId}`);
      return;
    }
    
    this.logger.debug(`Broadcasting command to room ${projectId} from ${senderId}: ${commandData.type}`);
    
    // Prepare the command data with sender information
    const messageToSend = {
      ...commandData,
      senderId,
      timestamp: commandData.timestamp || Date.now()
    };
    
    // Send to all clients in the room except the sender
    room.forEach((clientInfo, userId) => {
      if (userId !== senderId && clientInfo.client.readyState === WebSocket.OPEN) {
        this.sendToClient(clientInfo.client, messageToSend);
      }
    });
  }
  
  /**
   * Send a message to a specific client
   */
  private sendToClient(client: WebSocket, data: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
  
  /**
   * Get all clients in a room
   */
  getClientsInRoom(projectId: string): ClientInfo[] {
    const room = this.rooms.get(projectId);
    return room ? Array.from(room.values()) : [];
  }
  
  /**
   * Get room information including client count
   */
  getRoomInfo(projectId: string) {
    const room = this.rooms.get(projectId);
    if (!room) return null;
    
    return {
      projectId,
      clientCount: room.size,
      clients: Array.from(room.values()).map(client => ({
        userId: client.userId,
        username: client.user?.name || client.user?.email || 'Anonymous',
      }))
    };
  }
  
  /**
   * Get all active rooms
   */
  getAllRooms() {
    return Array.from(this.rooms.keys()).map(projectId => ({
      projectId,
      clientCount: this.rooms.get(projectId)?.size
    }));
  }
}