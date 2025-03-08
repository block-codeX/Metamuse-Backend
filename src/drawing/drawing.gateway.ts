import { WebSocketGateway, SubscribeMessage, MessageBody, OnGatewayDisconnect, OnGatewayInit, WebSocketServer } from '@nestjs/websockets';
import { DrawingService } from './drawing.service';
import { CreateDrawingDto } from './dto/create-drawing.dto';
import { UpdateDrawingDto } from './dto/update-drawing.dto';
import { AuthWsMiddleware } from 'src/auth/auth.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { UsersService } from 'src/users/users.service';

@WebSocketGateway()
export class DrawingGateway implements OnGatewayInit, OnGatewayDisconnect {
    constructor(
      private readonly jwtService: JwtService,
      private readonly authService: AuthService,
      private readonly usersService: UsersService,
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
      // server.use(RoomWsMiddleware(this.conversationService));
    }
  
    async handleDisconnect(client: any) {
      // Leave all rooms
      client.rooms.forEach((room: string) => {
        client.leave(room);
      });
      console.log('Client disconnected');
    }
  
  
  @SubscribeMessage('createDrawing')
  create(@MessageBody() createDrawingDto: CreateDrawingDto) {
    return this.drawingService.create(createDrawingDto);
  }

  @SubscribeMessage('findAllDrawing')
  findAll() {
    return this.drawingService.findAll();
  }

  @SubscribeMessage('findOneDrawing')
  findOne(@MessageBody() id: number) {
    return this.drawingService.findOne(id);
  }

  @SubscribeMessage('updateDrawing')
  update(@MessageBody() updateDrawingDto: UpdateDrawingDto) {
    return this.drawingService.update(updateDrawingDto.id, updateDrawingDto);
  }

  @SubscribeMessage('removeDrawing')
  remove(@MessageBody() id: number) {
    return this.drawingService.remove(id);
  }
}
