import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DB_CONNECTION_STRING } from '@app/utils';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConversationModule } from './conversation/conversation.module';
import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { ProjectModule } from './project/project.module';
import { YjsWebSocketGateway } from './project/yjs.gateway';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    MongooseModule.forRoot(DB_CONNECTION_STRING),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ConversationModule,
    ChatModule,
    NotificationModule,
    ProjectModule,
    WalletsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway, YjsWebSocketGateway],
})
export class AppModule {}
