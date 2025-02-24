import {
  JWT_VERIFYING_KEY,
  JWT_ALGORITHM,
  JWT_ACCESS_TOKEN_EXPIRATION,
  UnauthorizedError,
  JWT_AUTH_HEADERS,
} from '@app/utils';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';

type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;

function extractSocketTokenFromHeader(socket): string {
  let token_string = socket.handshake?.auth?.token;
  if (!token_string) {
    token_string = socket.handshake?.headers?.authorization;
  }
  if (!token_string) {
    throw new UnauthorizedError('Token not provided');
  }
  const [type, token] = token_string.split(' ');
  if (!JWT_AUTH_HEADERS.includes(type)) {
    throw new UnauthorizedError('Token type not supported');
  }
  return token;
}

export const AuthWsMiddleware = (
  jwtService: JwtService,
  authService: AuthService,
  userService: UsersService,
): SocketMiddleware => {
  return async (socket: any, next) => {
    try {
      const token = extractSocketTokenFromHeader(socket);
      if (await authService.isTokenBlacklisted(token, 'access')) {
        throw new UnauthorizedError('Token is blacklisted');
      }
      const decoded = await jwtService.verifyAsync(token, {
        secret: JWT_VERIFYING_KEY,
        algorithms: [JWT_ALGORITHM],
        maxAge: JWT_ACCESS_TOKEN_EXPIRATION,
        ignoreExpiration: false,
      });
      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Token provided is not an access token');
      }
      const user = await userService.findOne(
        Types.ObjectId.createFromHexString(decoded.sub ?? ''),
      );
      if (user.status !== 'active')
        throw new UnauthorizedError(`User is ${user.status}`);
      socket.user = user;
      socket.token = token;
      next();
    } catch (error) {
      console.error(error);
      next(
        new Error(
          error instanceof UnauthorizedError
            ? error.message
            : 'Unauthorized, something went wrong',
        ),
      );
    }
  };
};
