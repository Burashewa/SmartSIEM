import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class PasswordResetRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly cooldownUntil = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  assertCooldown(scope: string, key: string, cooldownMs: number): void {
    const bucketKey = `${scope}:${key}`;
    const until = this.cooldownUntil.get(bucketKey) ?? 0;
    const now = Date.now();
    if (until > now) {
      const retryAfterSec = Math.ceil((until - now) / 1000);
      throw new HttpException(
        {
          message: `Please wait ${retryAfterSec} seconds before resending the verification email.`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordCooldown(scope: string, key: string, cooldownMs: number): void {
    const bucketKey = `${scope}:${key}`;
    this.cooldownUntil.set(bucketKey, Date.now() + cooldownMs);
  }

  assertAllowed(
    scope: 'request' | 'complete' | 'verify-resend' | 'verify-complete',
    key: string,
  ): void {
    const configKeyByScope: Record<typeof scope, string> = {
      request: 'AUTH_PASSWORD_RESET_MAX_PER_HOUR',
      complete: 'AUTH_PASSWORD_RESET_COMPLETE_MAX_PER_HOUR',
      'verify-resend': 'AUTH_EMAIL_VERIFY_RESEND_MAX_PER_HOUR',
      'verify-complete': 'AUTH_EMAIL_VERIFY_COMPLETE_MAX_PER_HOUR',
    };
    const defaultByScope: Record<typeof scope, number> = {
      request: 5,
      complete: 10,
      'verify-resend': 5,
      'verify-complete': 20,
    };
    const max = Number(
      this.configService.get<string>(configKeyByScope[scope]) ?? defaultByScope[scope],
    );
    const windowMs = 60 * 60 * 1000;
    const now = Date.now();
    const bucketKey = `${scope}:${key}`;
    const recent = (this.hits.get(bucketKey) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      throw new HttpException(
        'Too many password reset attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(bucketKey, recent);
  }

  static hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  }
}
