import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_ALGORITHM,
  JWT_AUTH_HEADERS,
  JWT_VERIFYING_KEY,
  UnauthorizedError,
} from '@app/utils';
import { Types } from 'mongoose';
import { AuthService, OTPService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.decorator';
import { otpSchema } from './auth.dto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private userService: UsersService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      if (await this.authService.isTokenBlacklisted(token, 'access')) {
        throw new UnauthorizedException();
      }
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: JWT_VERIFYING_KEY,
        algorithms: [JWT_ALGORITHM],
        maxAge: JWT_ACCESS_TOKEN_EXPIRATION,
        ignoreExpiration: false,
      });
      if (decoded.type !== 'access') {
        throw new UnauthorizedException();
      }
      const user = await this.userService.getUser(
        Types.ObjectId.createFromHexString(decoded.sub ?? ''),
      );
      request['user'] = user
      request['token'] = token;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (!JWT_AUTH_HEADERS.includes(type)) {
      return undefined;
    }
    return token;
  }
}


@Injectable()
export class OTPRequired implements CanActivate {
  constructor(
    private otpservice: OTPService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const otpData = request.body.otpData;
    try {
      otpSchema.parse(otpData);
    } catch (error) {
      throw new UnauthorizedException("Invalid OTP data", error.errors);
    }
    if (!otpData) {
      throw new UnauthorizedException("No otp provided");
    }
    try {
      await this.otpservice.verifyOTP(otpData);
      return true;
    }
    catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new UnauthorizedException(error.message);
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }
  }
}
