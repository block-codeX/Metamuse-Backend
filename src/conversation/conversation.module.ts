import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationService, MessageService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation, Message, ConversationSchema, MessageSchema } from './conversation.schema'
import { UsersModule } from 'src/users/users.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema }
    ]),
    UsersModule
  ],
  controllers: [ConversationController],
  providers: [ConversationService, MessageService],
  exports: [MongooseModule, ConversationService, MessageService],
})
export class ConversationModule {}
