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
import { YJS_REDIS_DB, YJS_REDIS_HOST, YJS_REDIS_PORT } from '@app/utils';

const redisConfig = {
  host: YJS_REDIS_HOST,
  port: YJS_REDIS_PORT,
  db: YJS_REDIS_DB,
};
@Module({
  imports: [
    AuthModule,
    ConversationModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
  ],
  providers: [
    {
      provide: 'REDIS_CONFIG', // Use a token to identify the provider
      useValue: redisConfig, // Provide the Redis configuration
    },
    ProjectGateway,
    ProjectService,
    AuthService,
    ConversationService,
    UsersService,
    CRDTService,
    FileService,
  ],
  exports: [ProjectService, CRDTService, FileService],
})
export class ProjectModule {}
