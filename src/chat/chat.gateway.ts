import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { CreateMessagingDto } from 'src/conversation/conversation.dto';
import { ConversationService, MessageService } from 'src/conversation/conversation.service';
import { Server } from 'socket.io';
import { AuthWsMiddleware } from '../auth/auth.middleware';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { RoomWsMiddleware } from './chat.middleware';

interface CreateMsg {
  conversation: string;
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
    console.log('Client disconnected');
  }

  @SubscribeMessage('create')
  async create(client: any, payload: CreateMsg): Promise<void> {
    const senderId = 
    this.server.emit('created', payload);
  }
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }

}
