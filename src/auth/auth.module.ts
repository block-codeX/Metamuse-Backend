import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BlacklistAccess,
  BlacklistAccessSchema,
  BlacklistRefresh,
  BlacklistRefreshSchema,
} from './auth.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlacklistAccess.name, schema: BlacklistAccessSchema },
      { name: BlacklistRefresh.name, schema: BlacklistRefreshSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, MongooseModule],
})
export class AuthModule {}
