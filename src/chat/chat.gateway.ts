import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { CreateMessagingDto } from 'src/conversation/conversation.dto';
import {
  ConversationService,
  MessageService,
} from 'src/conversation/conversation.service';
import { Server, WebSocket } from 'ws';
import { functionAuth } from '../auth/auth.middleware';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { functionRoomAuth } from './chat.middleware';
import { Types } from 'mongoose';
import { ConsoleLogger } from '@nestjs/common';

interface CreateMsg {
  content: string;
}
interface UpdateMsg {
  id: string;
  content: string;
}
interface CustomWebSocket extends WebSocket {
  user?: any;
  roomId?: string;
  handshake: {
    query: {
      token: string | null;
      roomId: string | null;
    };
  };
}
@WebSocketGateway({
  cors: { origin: '*' },
  path: "/chats"
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly messageService: MessageService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly conversationService: ConversationService,
  ) {}
  @WebSocketServer()
  server: Server;
  private readonly logger = new ConsoleLogger(ChatGateway.name);
  private rooms: Map<string, Set<WebSocket>> = new Map();

  async handleConnection(client: CustomWebSocket, request: Request) {
    try {
      const newUrl = new URL(request.url, 'http://localhost/chats');
      const params = newUrl.searchParams;
      const token = params.get('token');
      const roomId = params.get('roomId');
      client.handshake = { query: { token, roomId } };
      await functionAuth(
        client,
        this.jwtService,
        this.authService,
        this.usersService,
      );
      const chatRoom = await functionRoomAuth(client, this.conversationService);
      const userRoom = `user_${client.user._id}`;
      if (!this.rooms.has(chatRoom)) {
        this.rooms.set(chatRoom, new Set());
      }
      this.rooms.get(chatRoom)?.add(client);
      this.logger.log(
        `Client connected: ${client.user._id} to chat room: ${client.roomId}`,
      );
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, error.message);
      }
    }
  }

  handleDisconnect(client: CustomWebSocket) {
    this.rooms.forEach((clients, roomId) => {
      if (clients.has(client)) {
        clients.delete(client);
        console.log(`Client removed from room ${roomId}`);
      }
    });
    console.log('Client disconnected');
  }

  @SubscribeMessage('msg:create')
  async handleCreateMessage(client: any, payload: CreateMsg): Promise<any> {
    try {
      const sender = client.user._id;
      const conversation = client.roomId;
      const convo = await this.conversationService.findOne(new Types.ObjectId(conversation as string))
      const { content } = payload;
      const message = await this.messageService.create({
        conversation: new Types.ObjectId(conversation as string),
        sender,
        content,
        readBy: [sender]
      } as CreateMessagingDto);
        // @ts-ignore
      convo.lastMessage = message._id
      await convo.save()

      // @ts-ignore
      await message.populate('sender', 'id firstName lastName email');

      const chatRoom = this.getRoom(message);
      this.broadcastToRoom(chatRoom, 'msg:create', message);
    } catch (error) {
      console.error(error);
      this.sendError(client, 'msg:error', error.message);
    }
  }

  @SubscribeMessage('msg:update')
  async handleUpdateMessage(client: any, payload: UpdateMsg): Promise<void> {
    try {
      const sender = client.user._id;
      const { id, content } = payload;
      const msg = await this.messageService.findOne(new Types.ObjectId(id));
      
      const chat_room = this.getRoom(msg);
      if (!msg.sender.equals(sender)) {
        throw new Error('You are not the sender of this message');
      }
      const message = await this.messageService.update(
        new Types.ObjectId(id),
        content,
      );
      const convo = await this.conversationService.findOne(new Types.ObjectId(client.roomId as string))
      convo.lastMessage = new Types.ObjectId(id)
      await convo.save()
      await msg.populate('sender', 'id firstName lastName email');
      // emit to chat room
      this.broadcastToRoom(this.getRoom(message), 'msg:update', message);
    } catch (error) {
      console.error(error);
      client.emit('msg:error', error.message);
    }
  }

  @SubscribeMessage('msg:delete')
  async handleDeleteMessage(client: any, data: { id: string }): Promise<void> {
    try {
      const sender = client.user._id;
      const msg = await this.messageService.findOne(
        new Types.ObjectId(data.id),
      );
      if (!msg.sender.equals(sender)) {
        throw new Error('You are not the sender of this message');
      }
      await this.messageService.remove(new Types.ObjectId(data.id));
      const convo = await this.conversationService.findOne(new Types.ObjectId(client.roomId as string))
      if (convo.lastMessage && convo.lastMessage.equals(new Types.ObjectId(data.id))) {
        convo.lastMessage = null
        convo.save()
      }
      await convo.save()
      this.broadcastToRoom(this.getRoom(msg), 'msg:delete', data.id);
    } catch (error) {
      console.error(error);
      client.emit('msg:error', error.message);
    }
  }
  private getRoom(message: any) {
    return `chat_${message.conversation.toString()}`;
  }
  private broadcastToRoom(roomId: string, event: string, data: any): void {
    this.logger.log(`Broadcasting to room: ${roomId}`);
    const clients = this.rooms.get(roomId);
    if (clients) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ event, data }));
        }
      });
    }
  }

  @SubscribeMessage('msg:readAll')
  async handleReadMessage(client: any): Promise<void> {
    try {
      await this.conversationService.markAllAsSeen(
        new Types.ObjectId(client.roomId as string),
        client.user._id,
      )
      console.log('All messages marked as read');
      client.emit('msg:readAll', "All pending messages marked as read");
    } catch (error) {
      console.error(error);
      client.emit('msg:error', error.message);
    }
  }
  private sendError(client: WebSocket, event: string, message: string): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data: { message } }));
    }
  }
}
