import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Model, Types } from 'mongoose';
import { AuthUser } from './schemas/user.schema';
import { AuthSession } from './schemas/session.schema';
import { AuthEvent } from './schemas/auth-event.schema';
import { AuthJwtPayload, normalizeLegacyRole, SIEM_ROLES, SiemRole } from './auth.types';

const MIN_PASSWORD_LENGTH = 8;

type AuthRequestContext = {
  sourceIp?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSec: number;
  private readonly refreshTokenTtlSec: number;
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    @InjectModel(AuthUser.name) private readonly authUserModel: Model<AuthUser>,
    @InjectModel(AuthSession.name) private readonly authSessionModel: Model<AuthSession>,
    @InjectModel(AuthEvent.name) private readonly authEventModel: Model<AuthEvent>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenTtlSec = Number(this.configService.get<string>('JWT_ACCESS_TTL_SEC') ?? 900);
    this.refreshTokenTtlSec = Number(this.configService.get<string>('JWT_REFRESH_TTL_SEC') ?? 604800);
    this.maxFailedAttempts = Number(this.configService.get<string>('AUTH_MAX_FAILED_ATTEMPTS') ?? 5);
    this.lockoutMinutes = Number(this.configService.get<string>('AUTH_LOCKOUT_MINUTES') ?? 15);
  }

  async ensureBootstrapAdmin(): Promise<void> {
    const users = await this.authUserModel.countDocuments();
    if (users > 0) return;
    const username = (this.configService.get<string>('BOOTSTRAP_ADMIN_USERNAME') ?? 'admin').toLowerCase();
    const password = this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD') ?? 'ChangeMe!123';
    await this.createUser({
      username,
      password,
      role: 'admin',
      actor: 'system-bootstrap',
      sourceIp: '127.0.0.1',
    });
  }

  async createUser(input: {
    username: string;
    password: string;
    role: SiemRole;
    actor: string;
    sourceIp?: string;
  }): Promise<{ username: string; role: SiemRole }> {
    const username = input.username.trim().toLowerCase();
    if (!username || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    if (!SIEM_ROLES.includes(input.role)) {
      throw new BadRequestException(
        `Invalid role. Use one of: ${SIEM_ROLES.join(', ')}`,
      );
    }
    const exists = await this.authUserModel.findOne({ username }).lean();
    if (exists) throw new BadRequestException('Username already exists');

    const passwordHash = this.hashPassword(input.password);
    const user = await this.authUserModel.create({
      username,
      passwordHash,
      role: input.role,
      passwordChangedAt: new Date(),
    });
    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username,
      action: 'auth.user_create',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      reason: `created_by:${input.actor}`,
      metadata: { role: input.role },
    });
    return { username: user.username, role: user.role };
  }

  async registerUser(input: {
    username: string;
    password: string;
    role: SiemRole;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; role: SiemRole }> {
    const allowedInviteCode = this.configService.get<string>('AUTH_SELF_REGISTER_INVITE_CODE');
    const inviteCodeEnabled = Boolean(allowedInviteCode && allowedInviteCode.trim().length > 0);
    if (inviteCodeEnabled) {
      throw new BadRequestException(
        'Self-registration is disabled: set AUTH_SELF_REGISTER_INVITE_CODE in .env to empty, or use invite flow.',
      );
    }
    if (!input.role || !SIEM_ROLES.includes(input.role)) {
      throw new BadRequestException(
        `Invalid role. Use one of: ${SIEM_ROLES.join(', ')}`,
      );
    }

    const user = await this.createUser({
      username: input.username,
      password: input.password,
      role: input.role,
      actor: 'self-register',
      sourceIp: input.sourceIp,
    });

    await this.logEvent({
      username: user.username,
      action: 'auth.register',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      metadata: { role: user.role },
    });

    return user;
  }

  async setUserActiveStatus(input: {
    username: string;
    isActive: boolean;
    actor: string;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; isActive: boolean }> {
    const username = input.username.trim().toLowerCase();
    const user = await this.authUserModel.findOne({ username });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'admin' && input.isActive === false) {
      throw new BadRequestException('Admin users cannot be blocked');
    }
    user.isActive = input.isActive;
    await user.save();
    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: input.isActive ? 'auth.user_unblock' : 'auth.user_block',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      reason: `changed_by:${input.actor}`,
    });
    return { username: user.username, isActive: user.isActive };
  }

  async login(
    usernameInput: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<{ accessToken: string; refreshToken: string; expiresInSec: number; role: SiemRole; username: string }> {
    const username = usernameInput.trim().toLowerCase();
    const user = await this.authUserModel.findOne({ username });
    if (!user) {
      await this.logEvent({
        username,
        action: 'auth.login',
        outcome: 'failure',
        sourceIp: context.sourceIp ?? '',
        userAgent: context.userAgent ?? '',
        reason: 'user_not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.logEvent({
        userId: user._id as Types.ObjectId,
        username: user.username,
        action: 'auth.login',
        outcome: 'failure',
        sourceIp: context.sourceIp ?? '',
        userAgent: context.userAgent ?? '',
        reason: 'account_locked',
      });
      throw new UnauthorizedException('Account temporarily locked due to failed attempts');
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      const failed = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = failed >= this.maxFailedAttempts;
      user.failedLoginAttempts = failed;
      user.lockedUntil = shouldLock ? new Date(Date.now() + this.lockoutMinutes * 60_000) : undefined;
      await user.save();
      await this.logEvent({
        userId: user._id as Types.ObjectId,
        username: user.username,
        action: 'auth.login',
        outcome: 'failure',
        sourceIp: context.sourceIp ?? '',
        userAgent: context.userAgent ?? '',
        reason: shouldLock ? 'password_invalid_account_locked' : 'password_invalid',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedRole = normalizeLegacyRole(String(user.role));
    if (user.role !== normalizedRole) {
      user.set('role', normalizedRole);
    }
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = this.signToken(
      { sub: String(user._id), username: user.username, role: user.role, sid: sessionId, type: 'refresh' },
      this.refreshTokenTtlSec,
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change-me-refresh',
    );
    await this.authSessionModel.create({
      userId: user._id,
      sessionId,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSec * 1000),
      sourceIp: context.sourceIp ?? '',
      userAgent: context.userAgent ?? '',
    });

    const accessToken = this.signToken(
      { sub: String(user._id), username: user.username, role: user.role, sid: sessionId, type: 'access' },
      this.accessTokenTtlSec,
      this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'change-me-access',
    );

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.login',
      outcome: 'success',
      sourceIp: context.sourceIp ?? '',
      userAgent: context.userAgent ?? '',
    });
    return { accessToken, refreshToken, expiresInSec: this.accessTokenTtlSec, role: user.role, username: user.username };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresInSec: number }> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.authSessionModel.findOne({ sessionId: payload.sid, revokedAt: { $exists: false } });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
    if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.authUserModel.findById(payload.sub);
    if (!user) throw new NotFoundException('User not found');
    const newSessionId = randomBytes(16).toString('hex');
    session.revokedAt = new Date();
    await session.save();

    const newRefreshToken = this.signToken(
      { sub: String(user._id), username: user.username, role: user.role, sid: newSessionId, type: 'refresh' },
      this.refreshTokenTtlSec,
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change-me-refresh',
    );
    await this.authSessionModel.create({
      userId: user._id,
      sessionId: newSessionId,
      refreshTokenHash: this.hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSec * 1000),
      sourceIp: session.sourceIp,
      userAgent: session.userAgent,
    });
    const accessToken = this.signToken(
      { sub: String(user._id), username: user.username, role: user.role, sid: newSessionId, type: 'access' },
      this.accessTokenTtlSec,
      this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'change-me-access',
    );
    return { accessToken, refreshToken: newRefreshToken, expiresInSec: this.accessTokenTtlSec };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.authSessionModel.updateOne({ sessionId: payload.sid, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }

  async getUserContext(userId: string): Promise<{ username: string; role: SiemRole; lastLoginAt?: Date }> {
    const user = await this.authUserModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    return { username: user.username, role: user.role, lastLoginAt: user.lastLoginAt };
  }

  private signToken(payload: AuthJwtPayload, expiresInSec: number, secret: string): string {
    return this.jwtService.sign(payload, { secret, expiresIn: expiresInSec });
  }

  private verifyRefreshToken(token: string): AuthJwtPayload {
    try {
      const payload = this.jwtService.verify<AuthJwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change-me-refresh',
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${digest}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, digest] = storedHash.split(':');
    if (!salt || !digest) return false;
    const incoming = scryptSync(password, salt, 64);
    const existing = Buffer.from(digest, 'hex');
    return incoming.length === existing.length && timingSafeEqual(incoming, existing);
  }

  private hashToken(token: string): string {
    return scryptSync(token, 'refresh-token', 64).toString('hex');
  }

  private async logEvent(input: {
    userId?: Types.ObjectId;
    username: string;
    action: string;
    outcome: 'success' | 'failure';
    reason?: string;
    sourceIp?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.authEventModel.create({
      userId: input.userId,
      username: input.username,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason ?? '',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      metadata: input.metadata,
    });
  }
}
