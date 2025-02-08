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
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_ALGORITHM,
  JWT_SIGNING_KEY,
} from './auth.constants';
import { AuthGuard } from './auth.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlacklistAccess.name, schema: BlacklistAccessSchema },
      { name: BlacklistRefresh.name, schema: BlacklistRefreshSchema },
    ]),
    UsersModule,
    JwtModule.register({
      global: true,
      secret: JWT_SIGNING_KEY,
      signOptions: { 
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
      },
      verifyOptions: {
        algorithms: [JWT_ALGORITHM],
        maxAge: JWT_ACCESS_TOKEN_EXPIRATION,
        ignoreExpiration: false,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, {
    provide: APP_GUARD,
    useClass: AuthGuard,
  }],
  exports: [AuthService, MongooseModule],
})
export class AuthModule {}
