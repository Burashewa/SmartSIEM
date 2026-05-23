import { Global, Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthUser, AuthUserSchema } from './schemas/user.schema';
import { AuthSession, AuthSessionSchema } from './schemas/session.schema';
import { AuthEvent, AuthEventSchema } from './schemas/auth-event.schema';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuthEvent.name, schema: AuthEventSchema },
    ]),
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit(): Promise<void> {
    await this.authService.ensureBootstrapAdmin();
  }
}
