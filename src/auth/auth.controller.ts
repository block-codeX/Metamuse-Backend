import { Body, Controller, HttpCode, Post, UseGuards, Request } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AllowAny } from './auth.decorator';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService
    ) {}

    @AllowAny()
    @HttpCode(200)
    @Post('login')
    async login(@Body() body: { email: string; password: string }): Promise<any> {
        const user = await this.usersService.loginUser(body.email, body.password);
        const tokens = await this.authService.getTokens(user);
        return tokens;
    }

    @AllowAny()
    @HttpCode(201)
    @Post('signup')
    async signup(@Body() body: { email: string; password: string; firstName: string; lastName: string }): Promise<any> {
        const user = await this.usersService.signupUser(body);
        const tokens = await this.authService.getTokens(user);
        return tokens;
    }

    @Post('logout')
    async logout(@Request() req, @Body() body: { token: string }): Promise<void> {
        await this.authService.blacklistToken(req.token, 'access');
        await this.authService.blacklistToken(body.token, 'refresh');
    }
    @Post('profile')
    async profile(@Request() req): Promise<any> {
        return req.user.select('-password, -lastAuthChange, -__v').toObject();
    }

}
