import { Module } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { ConversationModule } from 'src/conversation/conversation.module';
import { ConversationService, MessageService } from 'src/conversation/conversation.service';
import { UsersService } from 'src/users/users.service';

@Module({
    imports: [ConversationModule],
    controllers: [],
    providers: [MessageService, AuthService, UsersService, ConversationService],
})
export class ChatModule {}
