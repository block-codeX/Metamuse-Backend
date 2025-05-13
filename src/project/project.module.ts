import { Module, Scope } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ConversationModule } from 'src/conversation/conversation.module';
import { UsersModule } from 'src/users/users.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { UsersService } from 'src/users/users.service';
import {
  CollaborationRequest,
  CollaborationRequestSchema,
  Project,
  ProjectSchema,
} from './project.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService, OTPService } from 'src/auth/auth.service';
import { YJS_HOST, YJS_PORT, YJS_USERNAME, YJS_PASSWORD  } from '@app/utils';
import { ProjectController } from './project.controller';
import { NotificationModule } from 'src/notification/notification.module';

const redisConfig = {
  host: YJS_HOST,
  port: YJS_PORT,
  username: YJS_USERNAME,
  password: YJS_PASSWORD,
  tls: {
    rejectUnauthorized: false,}
};
@Module({
  imports: [
    AuthModule,
    ConversationModule,
    UsersModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: CollaborationRequest.name, schema: CollaborationRequestSchema },
    ]),
  ],
  providers: [
    ProjectService,
    AuthService,
    ConversationService,
    UsersService,
    OTPService,

    {
      provide: 'REDIS_CONFIG', // Use a token to identify the provider
      useValue: redisConfig, // Provide the Redis configuration
      scope: Scope.DEFAULT, // Default scope
    }
  ],
  exports: [ProjectService, 'REDIS_CONFIG'],
  controllers: [ProjectController],
})
export class ProjectModule {}
