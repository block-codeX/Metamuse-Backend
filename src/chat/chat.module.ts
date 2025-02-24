import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { ConversationModule } from 'src/conversation/conversation.module';
import { ConversationService, MessageService } from 'src/conversation/conversation.service';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';

@Module({
    imports: [ConversationModule, AuthModule, UsersModule],
    controllers: [],
    providers: [MessageService, AuthService, UsersService, ConversationService],
})
export class ChatModule {}
