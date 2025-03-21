import { Module, Scope } from '@nestjs/common';
import { ProjectService, CRDTService, FileService } from './project.service';
import { ConversationModule } from 'src/conversation/conversation.module';
import { UsersModule } from 'src/users/users.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { UsersService } from 'src/users/users.service';
import { Project, ProjectSchema } from './project.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { YJS_REDIS_DB, YJS_REDIS_HOST, YJS_REDIS_PORT } from '@app/utils';
import { ProjectController } from './project.controller';

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

    ProjectService,
    AuthService,
    ConversationService,
    UsersService,
    CRDTService,
    FileService,
    {
      provide: 'REDIS_CONFIG', // Use a token to identify the provider
      useValue: redisConfig, // Provide the Redis configuration
      scope: Scope.DEFAULT, // Default scope
    },
  ],
  exports: [ProjectService, CRDTService, FileService, 'REDIS_CONFIG'],
  controllers: [ProjectController],
})
export class ProjectModule {}
