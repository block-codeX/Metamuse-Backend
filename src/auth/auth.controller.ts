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
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthService, OTPService } from './auth.service';
import { AllowAny } from './auth.decorator';
import {
  ForbiddenError,
  IntegrityError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ZodValidationPipe,
} from '@app/utils';
import { LoginDto, loginSchema, LogoutDto, logoutSchema, OtpRequestDto, otpRequestSchema, SignupDto, signupSchema } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly otpservice: OTPService,
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

  @AllowAny()
  @HttpCode(200)
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async refresh(@Body() body: LogoutDto): Promise<any> {
    try {
      const tokens = await this.authService.refreshTokens(body.token);
      return tokens;
    } catch (error) {
      if (error instanceof ForbiddenError)
        throw new ForbiddenException(error.message);
      else if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else if (error instanceof IntegrityError)
        throw new ConflictException(error.message);
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

  async verifyAccount() {
    // Verify account
  }

  async forgotPassword() {
    // Forgot password
  }

  @AllowAny()
  @Post('otp/request')
  @UsePipes(new ZodValidationPipe(otpRequestSchema))
  async requestOTP(@Request() req, @Body() body: OtpRequestDto): Promise<any> {
    try {
      const email = body.email;
      const user: any = await this.usersService.getUser(null, { email });
      const otp = await this.otpservice.createOTP(user._id, body.otpType, body.multiUse);
      console.log(otp);
      return { message: 'OTP sent successfully' };
    }
    catch (error) {
      if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else throw new BadRequestException(error.message);
    }
  }
  async verifyOTP() {
    // Verify OTP
  }


  @Post('profile')
  async profile(@Request() req): Promise<any> {
    return req.user.select('-password, -lastAuthChange, -__v').toObject();
  }
}