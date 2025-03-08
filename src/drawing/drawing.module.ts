import { Module } from '@nestjs/common';
import { DrawingService, CRDTService } from './drawing.service';
import { DrawingGateway } from './drawing.gateway';
import { ConversationModule } from 'src/conversation/conversation.module';
import { UsersModule } from 'src/users/users.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { UsersService } from 'src/users/users.service';
import { Project, DrawingSchema } from './drawing.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConversationModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Project.name, schema: DrawingSchema }]),
  ],
  providers: [
    DrawingGateway,
    DrawingService,
    ConversationService,
    UsersService,
  ],
  exports: [DrawingService, CRDTService]
})
export class DrawingModule {}
