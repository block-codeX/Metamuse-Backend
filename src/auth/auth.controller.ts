import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  UsePipes,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { AllowAny } from './auth.decorator';
import {
  IntegrityError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ZodValidationPipe,
} from '@app/utils';
import { LoginDto, loginSchema, LogoutDto, logoutSchema, SignupDto, signupSchema } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @AllowAny()
  @HttpCode(200)
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginDto): Promise<any> {
    try {
      const user = await this.usersService.loginUser(body.email, body.password);
      const tokens = await this.authService.getTokens(user);
      return tokens;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message, error.name);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @HttpCode(201)
  @Post('signup')
  @UsePipes(new ZodValidationPipe(signupSchema))
  async signup(@Body() body: SignupDto): Promise<any> {
    try {
      const user = await this.usersService.signupUser(body);
      const tokens = await this.authService.getTokens(user);
      return tokens;
    } catch (error) {
      if (error instanceof IntegrityError)
        throw new ConflictException(error.message, error.name);
      else throw new BadRequestException(error.message);
    }
  }

  @Post('logout')
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async logout(@Request() req, @Body() body: LogoutDto): Promise<any> {
    try {
      await this.authService.blacklistToken(req.token, 'access');
      await this.authService.blacklistToken(body.token, 'refresh');
      return { message: 'Successfully logged out' };
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof IntegrityError)
        throw new ConflictException(error.message);
      else throw new BadRequestException(error.message);
    }
  }
  @Post('profile')
  async profile(@Request() req): Promise<any> {
    return req.user.select('-password, -lastAuthChange, -__v').toObject();
  }
}
