import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Model, Types } from 'mongoose';
import { AuthUser } from './schemas/user.schema';
import { AuthSession } from './schemas/session.schema';
import { AuthEvent } from './schemas/auth-event.schema';
import { AuthJwtPayload, normalizeLegacyRole, SIEM_ROLES, SiemRole } from './auth.types';
import { MailService } from '../mail/mail.service';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_RESET_EXPIRES_MINUTES = 60;

type AuthRequestContext = {
  sourceIp?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
    private readonly mailService: MailService,
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
    email?: string;
  }): Promise<{ username: string; role: SiemRole; email?: string }> {
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

    const email = this.normalizeEmail(input.email);
    if (email) {
      const emailTaken = await this.authUserModel.findOne({ email }).lean();
      if (emailTaken) throw new BadRequestException('Email already in use');
    }

    const passwordHash = this.hashPassword(input.password);
    const user = await this.authUserModel.create({
      username,
      email,
      passwordHash,
      authProvider: 'local',
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
    return { username: user.username, role: user.role, email: user.email };
  }

  async registerUser(input: {
    username: string;
    password: string;
    role: SiemRole;
    email?: string;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; role: SiemRole; email?: string }> {
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
      email: input.email,
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

    if (user.authProvider === 'google' || !user.passwordHash) {
      throw new UnauthorizedException('This account uses Google sign-in. Use Continue with Google.');
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

    return this.issueSession(user, context, 'auth.login');
  }

  async requestPasswordReset(
    identifierInput: string,
  ): Promise<{ message: string; devResetUrl?: string; emailSent?: boolean }> {
    const identifier = identifierInput.trim().toLowerCase();
    const genericMessage =
      'If an account exists for that username or email, password reset instructions have been sent.';

    if (!identifier) {
      throw new BadRequestException('Username or email is required');
    }

    const user = await this.authUserModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user || !user.isActive || user.authProvider === 'google' || !user.passwordHash) {
      return { message: genericMessage };
    }

    const resetToken = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = this.hashResetToken(resetToken);
    user.passwordResetExpires = new Date(
      Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000,
    );
    await user.save();

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.password_reset_request',
      outcome: 'success',
      metadata: { expiresAt: user.passwordResetExpires },
    });

    const publicAppUrl = (this.configService.get<string>('APP_PUBLIC_URL') ?? '').replace(/\/$/, '');
    const exposeDevLink =
      (this.configService.get<string>('AUTH_EXPOSE_RESET_LINK') ?? 'false').toLowerCase() ===
      'true';

    if (!publicAppUrl) {
      this.logger.warn(
        'APP_PUBLIC_URL is not set; password reset links cannot be built. Configure APP_PUBLIC_URL in .env.',
      );
      return { message: genericMessage };
    }

    const resetUrl = `${publicAppUrl}/login?resetToken=${encodeURIComponent(resetToken)}`;
    const recipient = user.email?.trim().toLowerCase();

    if (this.mailService.isConfigured() && recipient) {
      try {
        await this.mailService.sendPasswordResetEmail({
          to: recipient,
          username: user.username,
          resetUrl,
          expiresMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
        });
        await this.logEvent({
          userId: user._id as Types.ObjectId,
          username: user.username,
          action: 'auth.password_reset_email',
          outcome: 'success',
          metadata: { to: recipient },
        });
        return {
          message:
            'If an account exists for that address, a password reset email has been sent. Check your inbox and spam folder.',
          emailSent: true,
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown_error';
        this.logger.error(`Failed to send password reset email to ${recipient}: ${reason}`);
        await this.logEvent({
          userId: user._id as Types.ObjectId,
          username: user.username,
          action: 'auth.password_reset_email',
          outcome: 'failure',
          reason,
          metadata: { to: recipient },
        });
      }
    } else if (!recipient) {
      this.logger.warn(
        `Password reset requested for ${user.username} but no email is on file. Add an email to the account or use Google sign-in.`,
      );
    } else if (!this.mailService.isConfigured()) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Password reset email was not sent.',
      );
    }

    let devResetUrl: string | undefined;
    if (exposeDevLink) {
      devResetUrl = resetUrl;
      this.logger.log(`[auth] Dev password reset link for ${user.username}: ${devResetUrl}`);
    }

    return { message: genericMessage, devResetUrl, emailSent: false };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
    if (!token?.trim()) {
      throw new BadRequestException('Reset token is required');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const users = await this.authUserModel
      .find({
        passwordResetExpires: { $gt: new Date() },
        passwordResetTokenHash: { $exists: true },
      })
      .limit(50)
      .exec();

    const user = users.find((candidate) =>
      this.verifyResetToken(token.trim(), candidate.passwordResetTokenHash),
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = this.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.password_reset_complete',
      outcome: 'success',
    });

    return { ok: true, message: 'Password updated. You can sign in with your new password.' };
  }

  async loginWithGoogle(
    credential: string,
    context: AuthRequestContext,
  ): Promise<{ accessToken: string; refreshToken: string; expiresInSec: number; role: SiemRole; username: string }> {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!googleClientId) {
      throw new BadRequestException('Google sign-in is not configured on this server');
    }
    if (!credential?.trim()) {
      throw new BadRequestException('Google credential is required');
    }

    const client = new OAuth2Client(googleClientId);
    let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string };
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential.trim(),
        audience: googleClientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    const googleId = payload.sub?.trim();
    const email = payload.email?.trim().toLowerCase();
    if (!googleId || !email || payload.email_verified === false) {
      throw new UnauthorizedException('Google account email could not be verified');
    }

    let user =
      (await this.authUserModel.findOne({ googleId })) ??
      (await this.authUserModel.findOne({ email }));

    if (!user) {
      const username = await this.allocateUsernameFromEmail(email, googleId);
      user = await this.authUserModel.create({
        username,
        email,
        googleId,
        authProvider: 'google',
        role: 'security_analyst',
        isActive: true,
        lastLoginAt: new Date(),
      });
      await this.logEvent({
        userId: user._id as Types.ObjectId,
        username: user.username,
        action: 'auth.google_register',
        outcome: 'success',
        sourceIp: context.sourceIp ?? '',
        userAgent: context.userAgent ?? '',
        metadata: { email },
      });
    } else {
      if (!user.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.email) {
        user.email = email;
      }
      if (user.authProvider !== 'google') {
        user.authProvider = 'google';
      }
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = new Date();
      await user.save();
    }

    return this.issueSession(user, context, 'auth.google_login');
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

  private async issueSession(
    user: AuthUser,
    context: AuthRequestContext,
    successAction: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresInSec: number; role: SiemRole; username: string }> {
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
      action: successAction,
      outcome: 'success',
      sourceIp: context.sourceIp ?? '',
      userAgent: context.userAgent ?? '',
    });

    return {
      accessToken,
      refreshToken,
      expiresInSec: this.accessTokenTtlSec,
      role: user.role,
      username: user.username,
    };
  }

  private async allocateUsernameFromEmail(email: string, googleId: string): Promise<string> {
    const localPart = email.split('@')[0] ?? 'user';
    const base =
      localPart.replace(/[^a-z0-9._-]/gi, '').slice(0, 24).toLowerCase() ||
      `user_${googleId.slice(0, 8)}`;

    let candidate = base;
    let suffix = 0;
    while (await this.authUserModel.exists({ username: candidate })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
  }

  private hashResetToken(token: string): string {
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(token, salt, 64).toString('hex');
    return `${salt}:${digest}`;
  }

  private verifyResetToken(token: string, storedHash?: string): boolean {
    if (!storedHash) return false;
    const [salt, digest] = storedHash.split(':');
    if (!salt || !digest) return false;
    const incoming = scryptSync(token, salt, 64);
    const existing = Buffer.from(digest, 'hex');
    return incoming.length === existing.length && timingSafeEqual(incoming, existing);
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

  private normalizeEmail(value?: string): string | undefined {
    const email = value?.trim().toLowerCase();
    if (!email) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
    return email;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${digest}`;
  }

  private verifyPassword(password: string, storedHash?: string): boolean {
    if (!storedHash) return false;
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
