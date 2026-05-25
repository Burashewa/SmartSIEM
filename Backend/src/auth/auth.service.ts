import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
import {
  BOOTSTRAP_ADMIN_PASSWORD_DEFAULT,
  BOOTSTRAP_ADMIN_USERNAME,
  isReservedUsername,
} from './auth.constants';
import { AuthJwtPayload, normalizeLegacyRole, SIEM_ROLES, SiemRole } from './auth.types';
import { MailService } from '../mail/mail.service';
import { PasswordResetRateLimiter } from './password-reset-rate-limiter.service';
import { passwordPolicyErrorMessage } from './password-policy';
const PASSWORD_RESET_EXPIRES_MINUTES = 60;
const EMAIL_VERIFICATION_EXPIRES_HOURS = 24;

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
    private readonly passwordResetRateLimiter: PasswordResetRateLimiter,
  ) {
    this.accessTokenTtlSec = Number(this.configService.get<string>('JWT_ACCESS_TTL_SEC') ?? 900);
    this.refreshTokenTtlSec = Number(this.configService.get<string>('JWT_REFRESH_TTL_SEC') ?? 604800);
    this.maxFailedAttempts = Number(this.configService.get<string>('AUTH_MAX_FAILED_ATTEMPTS') ?? 5);
    this.lockoutMinutes = Number(this.configService.get<string>('AUTH_LOCKOUT_MINUTES') ?? 15);
  }

  async ensureBootstrapAdmin(): Promise<void> {
    const username = (
      this.configService.get<string>('BOOTSTRAP_ADMIN_USERNAME') ?? BOOTSTRAP_ADMIN_USERNAME
    )
      .trim()
      .toLowerCase();
    const password =
      this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD') ??
      BOOTSTRAP_ADMIN_PASSWORD_DEFAULT;

    const syncPassword =
      (this.configService.get<string>('BOOTSTRAP_ADMIN_SYNC_PASSWORD') ?? 'true').toLowerCase() ===
      'true';

    const existing = await this.authUserModel.findOne({ username });
    if (existing) {
      if (existing.role !== 'admin') {
        this.logger.warn(
          `Bootstrap skipped: user "${username}" exists but is not an admin (role=${existing.role}).`,
        );
        return;
      }

      let updated = false;
      if (syncPassword && !this.verifyPassword(password, existing.passwordHash)) {
        existing.passwordHash = this.hashPassword(password);
        existing.passwordChangedAt = new Date();
        updated = true;
      }
      if (!existing.emailVerified) {
        existing.emailVerified = true;
        existing.emailVerifiedAt = new Date();
        updated = true;
      }
      if ((existing.failedLoginAttempts ?? 0) > 0 || existing.lockedUntil) {
        existing.failedLoginAttempts = 0;
        existing.lockedUntil = undefined;
        updated = true;
      }
      if (existing.authProvider !== 'local' || !existing.passwordHash) {
        existing.authProvider = 'local';
        if (!existing.passwordHash && syncPassword) {
          existing.passwordHash = this.hashPassword(password);
          existing.passwordChangedAt = new Date();
        }
        updated = true;
      }

      if (updated) {
        await existing.save();
        this.logger.log(
          `Bootstrap admin "${username}" updated (password sync, unlock, or verification flags)`,
        );
      } else {
        this.logger.log(`Bootstrap admin "${username}" already exists`);
      }
      return;
    }

    await this.createUser({
      username,
      password,
      role: 'admin',
      actor: 'system-bootstrap',
      sourceIp: '127.0.0.1',
      emailVerified: true,
    });
    this.logger.log(`Bootstrap admin "${username}" created on startup`);
  }

  async createUser(input: {
    username: string;
    password: string;
    role: SiemRole;
    actor: string;
    sourceIp?: string;
    email?: string;
    emailVerified?: boolean;
  }): Promise<{ username: string; role: SiemRole; email?: string }> {
    const username = input.username.trim().toLowerCase();
    if (!username) {
      throw new BadRequestException('Username is required');
    }
    const passwordError = passwordPolicyErrorMessage(input.password);
    if (passwordError) {
      throw new BadRequestException(passwordError);
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
    const emailVerified =
      input.emailVerified !== undefined ? input.emailVerified : input.role === 'admin';
    const user = await this.authUserModel.create({
      username,
      email,
      passwordHash,
      authProvider: 'local',
      role: input.role,
      passwordChangedAt: new Date(),
      emailVerified: Boolean(emailVerified),
      ...(emailVerified ? { emailVerifiedAt: new Date() } : {}),
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
  }): Promise<{
    username: string;
    role: SiemRole;
    email?: string;
    message: string;
    verificationEmailSent: boolean;
  }> {
    const allowedInviteCode = this.configService.get<string>('AUTH_SELF_REGISTER_INVITE_CODE');
    const inviteCodeEnabled = Boolean(allowedInviteCode && allowedInviteCode.trim().length > 0);
    if (inviteCodeEnabled) {
      throw new BadRequestException(
        'Self-registration is disabled: set AUTH_SELF_REGISTER_INVITE_CODE in .env to empty, or use invite flow.',
      );
    }
    const normalizedUsername = input.username.trim().toLowerCase();
    if (isReservedUsername(normalizedUsername)) {
      throw new BadRequestException(
        'This username is reserved. Admin accounts cannot be created via registration.',
      );
    }
    if (input.role === 'admin') {
      throw new BadRequestException(
        'Admin accounts cannot be registered. Sign in with an existing admin account or contact your administrator.',
      );
    }

    const email = this.normalizeEmail(input.email);
    if (!email) {
      throw new BadRequestException('A valid email address is required to register as a security analyst.');
    }

    const user = await this.createUser({
      username: input.username,
      password: input.password,
      role: 'security_analyst',
      email,
      actor: 'self-register',
      sourceIp: input.sourceIp,
      emailVerified: false,
    });

    const verificationEmailSent = await this.issueEmailVerification(
      user.username,
      input.sourceIp ?? '',
    );

    if (!verificationEmailSent) {
      this.logger.error(
        `Verification email was not sent for ${user.username}. Check SMTP settings and backend logs.`,
      );
    } else {
      const cooldownSec = Number(
        this.configService.get<string>('AUTH_EMAIL_VERIFY_RESEND_COOLDOWN_SEC') ?? 60,
      );
      this.passwordResetRateLimiter.recordCooldown(
        'verify-resend',
        `id:${PasswordResetRateLimiter.hashIdentifier(email)}`,
        cooldownSec * 1000,
      );
    }

    await this.logEvent({
      username: user.username,
      action: 'auth.register',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      metadata: { role: user.role, email },
    });

    return {
      username: user.username,
      role: user.role,
      email: user.email,
      message: verificationEmailSent
        ? 'Account created. Check your email for a verification link before signing in.'
        : 'Account created. Email verification could not be sent — use Resend verification on the sign-in page.',
      verificationEmailSent,
    };
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

    if (this.mustVerifyEmailBeforeLogin(user)) {
      await this.logEvent({
        userId: user._id as Types.ObjectId,
        username: user.username,
        action: 'auth.login',
        outcome: 'failure',
        sourceIp: context.sourceIp ?? '',
        userAgent: context.userAgent ?? '',
        reason: 'email_not_verified',
      });
      throw new UnauthorizedException(
        'Please verify your email before signing in. Check your inbox or use Resend verification on the sign-in page.',
      );
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

  async verifyEmail(
    verificationId: string,
    sourceIp = '',
  ): Promise<{ ok: boolean; message: string }> {
    if (!verificationId?.trim()) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    const ipKey = sourceIp.trim() || 'unknown';
    this.passwordResetRateLimiter.assertAllowed('verify-complete', `ip:${ipKey}`);

    const user = await this.authUserModel.findOne({
      emailVerificationId: verificationId.trim(),
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    if (user.emailVerified) {
      return { ok: true, message: 'Email is already verified. You can sign in.' };
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationId = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.email_verified',
      outcome: 'success',
      sourceIp,
    });

    return { ok: true, message: 'Email verified successfully. You can now sign in.' };
  }

  async getVerificationStatus(identifierInput: string): Promise<{
    found: boolean;
    verified: boolean;
    username?: string;
  }> {
    const identifier = identifierInput.trim().toLowerCase();
    if (!identifier) {
      throw new BadRequestException('Email or username is required');
    }

    const user = await this.authUserModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user) {
      return { found: false, verified: false };
    }

    return {
      found: true,
      verified: user.emailVerified === true,
      username: user.username,
    };
  }

  async resendVerificationEmail(
    identifierInput: string,
    sourceIp = '',
  ): Promise<{ message: string; retryAfterSec: number }> {
    const identifier = identifierInput.trim().toLowerCase();
    const genericMessage =
      'If an unverified account exists for that email, a new verification link has been sent.';

    if (!identifier) {
      throw new BadRequestException('Email or username is required');
    }

    const ipKey = sourceIp.trim() || 'unknown';
    const idKey = `id:${PasswordResetRateLimiter.hashIdentifier(identifier)}`;
    const cooldownSec = Number(
      this.configService.get<string>('AUTH_EMAIL_VERIFY_RESEND_COOLDOWN_SEC') ?? 60,
    );
    const cooldownMs = cooldownSec * 1000;

    this.passwordResetRateLimiter.assertCooldown('verify-resend', idKey, cooldownMs);
    this.passwordResetRateLimiter.assertAllowed('verify-resend', `ip:${ipKey}`);
    this.passwordResetRateLimiter.assertAllowed('verify-resend', idKey);

    const user = await this.authUserModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (
      !user ||
      !user.isActive ||
      user.authProvider === 'google' ||
      user.emailVerified === true ||
      !user.email
    ) {
      return { message: genericMessage, retryAfterSec: cooldownSec };
    }

    const sent = await this.issueEmailVerification(user.username, sourceIp, {
      invalidatePrevious: true,
    });
    if (!sent) {
      throw new ServiceUnavailableException(
        'We could not send the verification email right now. Please try again in a minute.',
      );
    }
    this.passwordResetRateLimiter.recordCooldown('verify-resend', idKey, cooldownMs);
    return { message: genericMessage, retryAfterSec: cooldownSec };
  }

  async requestPasswordReset(
    identifierInput: string,
    sourceIp = '',
  ): Promise<{ message: string }> {
    const identifier = identifierInput.trim().toLowerCase();
    const genericMessage =
      'If an account exists for that username or email, password reset instructions have been sent.';

    if (!identifier) {
      throw new BadRequestException('Username or email is required');
    }

    const ipKey = sourceIp.trim() || 'unknown';
    this.passwordResetRateLimiter.assertAllowed('request', `ip:${ipKey}`);
    this.passwordResetRateLimiter.assertAllowed(
      'request',
      `id:${PasswordResetRateLimiter.hashIdentifier(identifier)}`,
    );

    const user = await this.authUserModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user || !user.isActive || user.authProvider === 'google' || !user.passwordHash) {
      return { message: genericMessage };
    }

    const resetId = randomBytes(32).toString('hex');
    user.passwordResetId = resetId;
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

    const resetUrl = `${publicAppUrl}/login?reset=${encodeURIComponent(resetId)}`;
    const recipient = user.email?.trim().toLowerCase();

    if (!recipient) {
      this.logger.warn(
        `Password reset for "${user.username}": no email on account — register with an email or add one via Admin Console.`,
      );
    } else if (!this.mailService.isConfigured()) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Password reset email was not sent.',
      );
    } else {
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
    }

    if (exposeDevLink) {
      this.logger.log(`[auth] Dev password reset link for ${user.username}: ${resetUrl}`);
    }

    return { message: genericMessage };
  }

  async resetPassword(
    resetId: string,
    newPassword: string,
    sourceIp = '',
  ): Promise<{ ok: boolean; message: string }> {
    if (!resetId?.trim()) {
      throw new BadRequestException('Reset link is invalid or expired');
    }
    const passwordError = passwordPolicyErrorMessage(newPassword);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    const ipKey = sourceIp.trim() || 'unknown';
    this.passwordResetRateLimiter.assertAllowed('complete', `ip:${ipKey}`);

    const user = await this.authUserModel.findOne({
      passwordResetId: resetId.trim(),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    user.passwordHash = this.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.passwordResetId = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );

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
        emailVerified: true,
        emailVerifiedAt: new Date(),
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
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
      user.emailVerificationId = undefined;
      user.emailVerificationExpires = undefined;
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
    if (this.mustVerifyEmailBeforeLogin(user)) {
      throw new UnauthorizedException(
        'Please verify your email before signing in.',
      );
    }
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

  async listUsersForAdmin(): Promise<
    Array<{
      id: string;
      username: string;
      role: SiemRole;
      isActive: boolean;
      status: 'active' | 'disabled' | 'locked';
      failedLoginAttempts: number;
      lockedUntil?: string;
      lastLoginAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }>
  > {
    const users = await this.authUserModel.find().select('-passwordHash').sort({ username: 1 }).lean();
    const now = Date.now();
    return users.map((user) => {
      const locked =
        user.lockedUntil instanceof Date ? user.lockedUntil.getTime() > now : false;
      let status: 'active' | 'disabled' | 'locked' = 'active';
      if (!user.isActive) status = 'disabled';
      else if (locked) status = 'locked';

      return {
        id: String(user._id),
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        status,
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        lockedUntil: user.lockedUntil?.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString(),
        createdAt: (user as { createdAt?: Date }).createdAt?.toISOString(),
        updatedAt: (user as { updatedAt?: Date }).updatedAt?.toISOString(),
      };
    });
  }

  async getUserForAdmin(usernameInput: string): Promise<{
    id: string;
    username: string;
    role: SiemRole;
    isActive: boolean;
    status: 'active' | 'disabled' | 'locked';
    failedLoginAttempts: number;
    lockedUntil?: string;
    lastLoginAt?: string;
    createdAt?: string;
    updatedAt?: string;
  }> {
    const username = usernameInput.trim().toLowerCase();
    const all = await this.listUsersForAdmin();
    const found = all.find((u) => u.username === username);
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async updateUserAsAdmin(input: {
    username: string;
    role?: SiemRole;
    isActive?: boolean;
    actor: string;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; role: SiemRole; isActive: boolean }> {
    const username = input.username.trim().toLowerCase();
    const user = await this.authUserModel.findOne({ username });
    if (!user) throw new NotFoundException('User not found');

    if (input.role !== undefined) {
      if (!SIEM_ROLES.includes(input.role)) {
        throw new BadRequestException(`Invalid role. Use one of: ${SIEM_ROLES.join(', ')}`);
      }
      if (user.role === 'admin' && input.role !== 'admin') {
        const adminCount = await this.authUserModel.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          throw new BadRequestException('Cannot demote the last active admin');
        }
      }
      user.role = input.role;
    }

    if (input.isActive !== undefined) {
      if (user.role === 'admin' && input.isActive === false) {
        throw new BadRequestException('Admin users cannot be disabled');
      }
      user.isActive = input.isActive;
    }

    await user.save();
    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.user_update',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      reason: `changed_by:${input.actor}`,
      metadata: {
        role: user.role,
        isActive: user.isActive,
      },
    });

    return { username: user.username, role: user.role, isActive: user.isActive };
  }

  async unlockUserAsAdmin(input: {
    username: string;
    actor: string;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; unlocked: boolean }> {
    const username = input.username.trim().toLowerCase();
    const user = await this.authUserModel.findOne({ username });
    if (!user) throw new NotFoundException('User not found');

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.user_unlock',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      reason: `unlocked_by:${input.actor}`,
    });

    return { username: user.username, unlocked: true };
  }

  async resetPasswordAsAdmin(input: {
    username: string;
    password: string;
    actor: string;
    sourceIp?: string;
    userAgent?: string;
  }): Promise<{ username: string; passwordReset: boolean }> {
    const username = input.username.trim().toLowerCase();
    const passwordError = passwordPolicyErrorMessage(input.password);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    const user = await this.authUserModel.findOne({ username });
    if (!user) throw new NotFoundException('User not found');

    user.passwordHash = this.hashPassword(input.password);
    user.passwordChangedAt = new Date();
    user.passwordResetId = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.password_reset',
      outcome: 'success',
      sourceIp: input.sourceIp ?? '',
      userAgent: input.userAgent ?? '',
      reason: `reset_by:${input.actor}`,
    });

    return { username: user.username, passwordReset: true };
  }

  async listAuditEventsForAdmin(input: {
    limit?: number;
    offset?: number;
    username?: string;
    action?: string;
    since?: string;
    until?: string;
  }): Promise<{
    items: Array<{
      id: string;
      username: string;
      action: string;
      outcome: string;
      reason: string;
      sourceIp: string;
      userAgent: string;
      metadata?: Record<string, unknown>;
      createdAt?: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const filter: Record<string, unknown> = {};

    if (input.username?.trim()) {
      filter.username = input.username.trim().toLowerCase();
    }
    if (input.action?.trim()) {
      filter.action = input.action.trim();
    }
    if (input.since || input.until) {
      const createdAt: Record<string, Date> = {};
      if (input.since) {
        const since = new Date(input.since);
        if (!Number.isNaN(since.getTime())) createdAt.$gte = since;
      }
      if (input.until) {
        const until = new Date(input.until);
        if (!Number.isNaN(until.getTime())) createdAt.$lte = until;
      }
      if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      this.authEventModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.authEventModel.countDocuments(filter),
    ]);

    return {
      items: items.map((event) => ({
        id: String(event._id),
        username: event.username,
        action: event.action,
        outcome: event.outcome,
        reason: event.reason ?? '',
        sourceIp: event.sourceIp ?? '',
        userAgent: event.userAgent ?? '',
        metadata: event.metadata,
        createdAt: (event as { createdAt?: Date }).createdAt?.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  async countUsersSummary(): Promise<{
    total: number;
    active: number;
    disabled: number;
    locked: number;
    admins: number;
  }> {
    const users = await this.listUsersForAdmin();
    return {
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      disabled: users.filter((u) => u.status === 'disabled').length,
      locked: users.filter((u) => u.status === 'locked').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }

  private getPublicAppUrl(): string {
    return (this.configService.get<string>('APP_PUBLIC_URL') ?? '').replace(/\/$/, '');
  }

  private mustVerifyEmailBeforeLogin(user: AuthUser): boolean {
    return (
      user.authProvider === 'local' &&
      user.role === 'security_analyst' &&
      user.emailVerified !== true
    );
  }

  private async issueEmailVerification(
    username: string,
    sourceIp: string,
    options?: { invalidatePrevious?: boolean },
  ): Promise<boolean> {
    const user = await this.authUserModel.findOne({ username: username.trim().toLowerCase() });
    if (!user?.email || user.emailVerified === true) {
      return false;
    }

    const verificationId = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    const publicAppUrl = this.getPublicAppUrl();
    if (!publicAppUrl) {
      this.logger.warn('APP_PUBLIC_URL is not set; verification links cannot be built.');
      return false;
    }

    const recipient = user.email.trim().toLowerCase();
    const verifyUrl = `${publicAppUrl}/login?verify=${encodeURIComponent(verificationId)}`;

    if (!this.mailService.isConfigured()) {
      this.logger.warn('SMTP is not configured; verification email was not sent.');
      return false;
    }

    const hadPreviousLink = Boolean(user.emailVerificationId);

    try {
      await this.mailService.sendEmailVerificationEmail({
        to: recipient,
        username: user.username,
        verifyUrl,
        expiresHours: EMAIL_VERIFICATION_EXPIRES_HOURS,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error(`Failed to send verification email to ${recipient}: ${reason}`);
      await this.logEvent({
        userId: user._id as Types.ObjectId,
        username: user.username,
        action: 'auth.email_verification_sent',
        outcome: 'failure',
        reason,
        sourceIp,
        metadata: { to: recipient },
      });
      return false;
    }

    // Only persist the new token after SMTP succeeds — previous links stay valid on send failure.
    user.emailVerificationId = verificationId;
    user.emailVerificationExpires = expiresAt;
    await user.save();

    await this.logEvent({
      userId: user._id as Types.ObjectId,
      username: user.username,
      action: 'auth.email_verification_sent',
      outcome: 'success',
      sourceIp,
      metadata: {
        to: recipient,
        previousLinkInvalidated:
          options?.invalidatePrevious === true && hadPreviousLink,
      },
    });
    return true;
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
