import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

import type { Transporter } from 'nodemailer';

import { normalizeEnvValue } from './mail.config';



export interface PasswordResetEmailParams {

  to: string;

  username: string;

  resetUrl: string;

  expiresMinutes: number;

}



export interface EmailVerificationParams {

  to: string;

  username: string;

  verifyUrl: string;

  expiresHours: number;

}



const DEFAULT_SMTP_TIMEOUT_MS = 60_000;

const MAX_SEND_ATTEMPTS = 3;



@Injectable()

export class MailService implements OnModuleInit {

  private readonly logger = new Logger(MailService.name);



  constructor(private readonly configService: ConfigService) {}



  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'SMTP not configured — set SMTP_HOST, SMTP_USER, and SMTP_PASS in SmartSIEM/.env or Backend/.env',
      );
      return;
    }

    // Verify in background so HTTP can bind immediately (Render health checks).
    void this.verifyConnection()
      .then(() => {
        this.logger.log(
          `SMTP ready (${this.getHost() || 'gmail'}:${this.getPort()}, timeout ${this.getTimeoutMs()}ms)`,
        );
      })
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`SMTP connection failed: ${reason}`);
      });
  }



  isConfigured(): boolean {

    return Boolean(this.getHost() && this.getUser() && this.getPass());

  }



  private getHost(): string {

    return normalizeEnvValue(this.configService.get<string>('SMTP_HOST'));

  }



  private getUser(): string {

    return normalizeEnvValue(this.configService.get<string>('SMTP_USER'));

  }



  private getPass(): string {

    return normalizeEnvValue(this.configService.get<string>('SMTP_PASS'));

  }



  private getPort(): number {

    return Number(normalizeEnvValue(this.configService.get<string>('SMTP_PORT')) || 465);

  }



  private isSecure(): boolean {

    return (

      normalizeEnvValue(this.configService.get<string>('SMTP_SECURE')).toLowerCase() === 'true'

    );

  }



  private getTimeoutMs(): number {

    const configured = Number(

      normalizeEnvValue(this.configService.get<string>('SMTP_TIMEOUT_MS')),

    );

    return configured > 0 ? configured : DEFAULT_SMTP_TIMEOUT_MS;

  }



  private getFromAddress(): string {

    const from = normalizeEnvValue(this.configService.get<string>('SMTP_FROM'));

    if (from) return from;

    return this.getUser();

  }



  private isGmailHost(): boolean {

    const host = this.getHost().toLowerCase();

    return host === 'smtp.gmail.com' || host === 'gmail';

  }



  private createTransporter(): Transporter {

    const timeout = this.getTimeoutMs();

    const auth = {

      user: this.getUser(),

      pass: this.getPass(),

    };

    const timeouts = {

      connectionTimeout: timeout,

      greetingTimeout: timeout,

      socketTimeout: timeout,

      dnsTimeout: timeout,

      // Prefer IPv4 — avoids long hangs on broken IPv6 routes (common on Windows).

      family: 4 as const,

    };



    if (this.isGmailHost()) {

      return nodemailer.createTransport({

        service: 'gmail',

        auth,

        ...timeouts,

      } as nodemailer.TransportOptions);

    }



    const port = this.getPort();

    const secure = this.isSecure();



    return nodemailer.createTransport({

      host: this.getHost(),

      port,

      secure,

      auth,

      ...timeouts,

      ...(port === 587 && !secure ? { requireTLS: true } : {}),

    } as nodemailer.TransportOptions);

  }



  private async closeTransporter(transport: Transporter): Promise<void> {

    try {

      transport.close();

    } catch {

      // ignore close errors

    }

  }



  private shouldRetrySmtpError(err: unknown): boolean {

    const message = err instanceof Error ? err.message : String(err);

    return /socket close|ECONNRESET|ETIMEDOUT|ETIME|connection closed|EPIPE|timeout|timed out/i.test(

      message,

    );

  }



  private async sendMailWithRetry(

    options: Parameters<Transporter['sendMail']>[0],

  ): Promise<void> {

    let lastError: unknown;



    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt += 1) {

      const transport = this.createTransporter();

      try {

        await transport.sendMail(options);

        await this.closeTransporter(transport);

        return;

      } catch (err) {

        await this.closeTransporter(transport);

        lastError = err;

        const reason = err instanceof Error ? err.message : String(err);

        if (attempt < MAX_SEND_ATTEMPTS - 1 && this.shouldRetrySmtpError(err)) {

          this.logger.warn(

            `SMTP send failed (attempt ${attempt + 1}/${MAX_SEND_ATTEMPTS}): ${reason}. Retrying...`,

          );

          continue;

        }

        throw err;

      }

    }



    throw lastError;

  }



  async verifyConnection(): Promise<void> {

    const transport = this.createTransporter();

    try {

      await transport.verify();

    } finally {

      await this.closeTransporter(transport);

    }

  }



  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {

    if (!this.isConfigured()) {

      throw new Error('SMTP is not configured');

    }



    const from = this.getFromAddress();

    const appName = normalizeEnvValue(this.configService.get<string>('APP_NAME')) || 'SmartSIEM';



    const text = [

      `Hello ${params.username},`,

      '',

      `You requested a password reset for your ${appName} account.`,

      `Use this link within ${params.expiresMinutes} minutes:`,

      params.resetUrl,

      '',

      'If you did not request this, you can ignore this email.',

    ].join('\n');



    const html = `

<!DOCTYPE html>

<html>

<body style="margin:0;padding:0;background:#0a0a0f;font-family:Segoe UI,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">

    <tr>

      <td align="center">

        <table width="100%" style="max-width:520px;background:#0f0f17;border:1px solid #252538;border-radius:12px;padding:32px;">

          <tr>

            <td>

              <p style="margin:0 0 8px;color:#818cf8;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${appName}</p>

              <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;">Reset your password</h1>

              <p style="margin:0 0 20px;color:#9ca3af;font-size:15px;line-height:1.5;">

                Hi <strong style="color:#e5e7eb;">${params.username}</strong>,

                we received a request to reset your password. Click the button below — the link expires in

                <strong style="color:#e5e7eb;">${params.expiresMinutes} minutes</strong>.

              </p>

              <a href="${params.resetUrl}"

                 style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;margin-bottom:24px;">

                Reset password

              </a>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5;">

                Or copy this link into your browser:

              </p>

              <p style="margin:0 0 24px;color:#6366f1;font-size:12px;word-break:break-all;">

                <a href="${params.resetUrl}" style="color:#818cf8;">${params.resetUrl}</a>

              </p>

              <p style="margin:0;color:#4b5563;font-size:12px;line-height:1.5;">

                If you did not request a password reset, you can safely ignore this email.

              </p>

            </td>

          </tr>

        </table>

      </td>

    </tr>

  </table>

</body>

</html>`.trim();



    try {

      await this.sendMailWithRetry({

        from,

        to: params.to,

        subject: `${appName} — Reset your password`,

        text,

        html,

      });

      this.logger.log(`Password reset email sent to ${params.to}`);

    } catch (err) {

      const reason = err instanceof Error ? err.message : String(err);

      this.logger.error(`SMTP send failed to ${params.to}: ${reason}`);

      throw err;

    }

  }



  async sendEmailVerificationEmail(params: EmailVerificationParams): Promise<void> {

    if (!this.isConfigured()) {

      throw new Error('SMTP is not configured');

    }



    const from = this.getFromAddress();

    const appName = normalizeEnvValue(this.configService.get<string>('APP_NAME')) || 'SmartSIEM';



    const text = [

      `Hello ${params.username},`,

      '',

      `Welcome to ${appName}. Please verify your email address to activate your account.`,

      `Use this link within ${params.expiresHours} hours:`,

      params.verifyUrl,

      '',

      'If you did not create this account, you can ignore this email.',

    ].join('\n');



    const html = `

<!DOCTYPE html>

<html>

<body style="margin:0;padding:0;background:#0a0a0f;font-family:Segoe UI,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">

    <tr>

      <td align="center">

        <table width="100%" style="max-width:520px;background:#0f0f17;border:1px solid #252538;border-radius:12px;padding:32px;">

          <tr>

            <td>

              <p style="margin:0 0 8px;color:#818cf8;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${appName}</p>

              <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;">Verify your email</h1>

              <p style="margin:0 0 20px;color:#9ca3af;font-size:15px;line-height:1.5;">

                Hi <strong style="color:#e5e7eb;">${params.username}</strong>,

                thanks for registering. Confirm your email to sign in — this link expires in

                <strong style="color:#e5e7eb;">${params.expiresHours} hours</strong>.

              </p>

              <a href="${params.verifyUrl}"

                 style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;margin-bottom:24px;">

                Verify email

              </a>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5;">

                Or copy this link into your browser:

              </p>

              <p style="margin:0 0 24px;color:#6366f1;font-size:12px;word-break:break-all;">

                <a href="${params.verifyUrl}" style="color:#818cf8;">${params.verifyUrl}</a>

              </p>

            </td>

          </tr>

        </table>

      </td>

    </tr>

  </table>

</body>

</html>`.trim();



    try {

      await this.sendMailWithRetry({

        from,

        to: params.to,

        subject: `${appName} — Verify your email`,

        text,

        html,

      });

      this.logger.log(`Verification email sent to ${params.to}`);

    } catch (err) {

      const reason = err instanceof Error ? err.message : String(err);

      this.logger.error(`SMTP send failed to ${params.to}: ${reason}`);

      throw err;

    }

  }

}

