import { Body, Controller, Post, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { AuthJwtPayload } from './auth.types';

type RequestLike = { ip?: string; headers?: Record<string, string>; user?: AuthJwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: { username: string; password: string; role: 'security_analyst' | 'admin' },
    @Req() request: RequestLike,
  ) {
    const user = await this.authService.registerUser({
      username: body.username,
      password: body.password,
      role: body.role,
      sourceIp: request.ip ?? '',
      userAgent: request.headers?.['user-agent'] ?? '',
    });
    return { ok: true, user };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Req() request: RequestLike,
  ) {
    return this.authService.login(body.username, body.password, {
      sourceIp: request.ip ?? '',
      userAgent: request.headers?.['user-agent'] ?? '',
    });
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.logout(body.refreshToken);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() request: RequestLike) {
    const user = request.user;
    if (!user) return null;
    return this.authService.getUserContext(user.sub);
  }

  @Roles('security_analyst')
  @Post('users')
  async createUser(
    @Body() body: { username: string; password: string; role: 'security_analyst' | 'admin' },
    @Req() request: RequestLike,
  ) {
    return this.authService.createUser({
      username: body.username,
      password: body.password,
      role: body.role,
      actor: request.user?.username ?? 'unknown',
      sourceIp: request.ip ?? '',
    });
  }

  @Roles('admin')
  @Post('users/block')
  async blockUser(
    @Body() body: { username: string; blocked: boolean },
    @Req() request: RequestLike,
  ) {
    return this.authService.setUserActiveStatus({
      username: body.username,
      isActive: !body.blocked,
      actor: request.user?.username ?? 'unknown',
      sourceIp: request.ip ?? '',
      userAgent: request.headers?.['user-agent'] ?? '',
    });
  }
}
