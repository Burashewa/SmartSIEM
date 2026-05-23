import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface PasswordResetEmailParams {
  to: string;
  username: string;
  resetUrl: string;
  expiresMinutes: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASS')?.trim();
    return Boolean(host && user && pass);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('SMTP_HOST')!.trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const secure =
      (this.configService.get<string>('SMTP_SECURE') ?? 'false').toLowerCase() === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: this.configService.get<string>('SMTP_USER')!.trim(),
        pass: this.configService.get<string>('SMTP_PASS')!.trim(),
      },
    });

    return this.transporter;
  }

  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('SMTP is not configured');
    }

    const from =
      this.configService.get<string>('SMTP_FROM')?.trim() ??
      this.configService.get<string>('SMTP_USER')!.trim();
    const appName = this.configService.get<string>('APP_NAME')?.trim() ?? 'SmartSIEM';

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

    await this.getTransporter().sendMail({
      from,
      to: params.to,
      subject: `${appName} — Reset your password`,
      text,
      html,
    });

    this.logger.log(`Password reset email sent to ${params.to}`);
  }
}
