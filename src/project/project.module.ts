import { Module } from '@nestjs/common';
import { ProjectService, CRDTService, FileService } from './project.service';
import { ProjectGateway } from './project.gateway';
import { ConversationModule } from 'src/conversation/conversation.module';
import { UsersModule } from 'src/users/users.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { UsersService } from 'src/users/users.service';
import { Project, ProjectSchema } from './project.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [
    AuthModule,
    ConversationModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
  ],
  providers: [
    ProjectGateway,
    ProjectService,
    AuthService,
    ConversationService,
    UsersService,
    CRDTService,
    FileService
  ],
  exports: [ProjectService, CRDTService, FileService]
})
export class ProjectModule {}
