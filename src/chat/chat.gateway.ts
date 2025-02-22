import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { CreateMessagingDto } from 'src/conversation/conversation.dto';
import { ConversationService, MessageService } from 'src/conversation/conversation.service';
import { Server } from 'socket.io';
import { AuthWsMiddleware } from '../auth/auth.middleware';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { RoomWsMiddleware } from './chat.middleware';
import { Types } from 'mongoose';

interface CreateMsg {
  conversation: string;
  content: string;
}
interface UpdateMsg {
  id: string;
  content: string;
}
@WebSocketGateway({
  namespace: "chat",
  cors: { origin: "*"}
})
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    private readonly messageService: MessageService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly conversationService: ConversationService,
  ) {}
  @WebSocketServer() 
  server: Server;

  async afterInit(server: Server) {
    server.use(
      AuthWsMiddleware(
        this.jwtService,
        this.authService,
        this.usersService,
      ))
    server.use(RoomWsMiddleware(this.conversationService));
  }

  async handleDisconnect(client: any) {
    // Leave all rooms
    client.rooms.forEach((room: string) => {
      client.leave(room);
    });
    console.log('Client disconnected');
  }

  @SubscribeMessage('create')
  async handleCreateMessage(client: any, payload: CreateMsg): Promise<void> {
    try {
      const sender = client.user._id;
      const { conversation, content } = payload;
      const message = await this.messageService.create({
        conversation: new Types.ObjectId(conversation),
        sender,
        content,
      } as CreateMessagingDto);
      const chat_room = this.getRoom(message);
      // Emit this event to the whole room
      client.to(chat_room).emit('new_message', message);
    } catch (error) {
      console.error(error);
      client.emit('create_error', error.message);
    }
  }

  @SubscribeMessage('update')
  async handleUpdateMessage(client: any, payload: UpdateMsg): Promise<void> {
    try {
      const sender = client.user._id;
      const { id, content } = payload;
      const msg = await this.messageService.findOne(new Types.ObjectId(id));
      const chat_room = this.getRoom(msg);
      if (!msg.sender.equals(sender)) {
        throw new Error('You are not the sender of this message');
      }
      const message = await this.messageService.update(new Types.ObjectId(id), content);
      // emit to chat room
      client.to(chat_room).emit('update_message', message);
    } catch (error) {
      console.error(error);
      client.emit('update_error', error.message);
    }
  }

  @SubscribeMessage('delete')
  async handleDeleteMessage(client: any, id: string): Promise<void> {
    try {
      const sender = client.user._id;
      const msg = await this.messageService.findOne(new Types.ObjectId(id));
      const chat_room = this.getRoom(msg);
      if (!msg.sender.equals(sender)) {
        throw new Error('You are not the sender of this message');
      }
      const message = await this.messageService.remove(new Types.ObjectId(id));
      // emit to chat room 
      client.to(chat_room).emit('delete_message', message);
    } catch (error) {
      console.error(error);
      client.emit('delete_error', error.message);
    }
  }
  private getRoom(message: any) {
    return `chat_${message.conversation.toString()}`;
  }
}
