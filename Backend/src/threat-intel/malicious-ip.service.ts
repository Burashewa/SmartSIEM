import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fast lookup for known-bad IPv4 indicators.
 * Configure real lists via `MALICIOUS_IPS` (comma-separated). Optional defaults use RFC 5737
 * TEST-NET addresses for lab demos only — replace in production with your threat-intel feed.
 */
@Injectable()
export class MaliciousIpService implements OnModuleInit {
  private readonly logger = new Logger(MaliciousIpService.name);
  private readonly ipv4 = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.reload();
  }

  /** Parse env again (e.g. after config hot-reload). */
  reload(): void {
    this.ipv4.clear();
    for (const ip of this.parseDefaultAndEnv()) {
      this.ipv4.add(ip);
    }
    this.logger.log(`Malicious IPv4 blocklist loaded: ${this.ipv4.size} entries`);
  }

  isListed(ip: string | undefined): boolean {
    const n = this.normalizeIpv4(ip);
    return n !== undefined && this.ipv4.has(n);
  }

  private parseDefaultAndEnv(): string[] {
    const raw =
      this.config.get<string>('MALICIOUS_IPS') ??
      this.config.get<string>('MALICIOUS_IP_LIST') ??
      '';
    const fromEnv = raw
      .split(/[\s,]+/u)
      .map((s) => this.normalizeIpv4(s))
      .filter((s): s is string => Boolean(s));

    const includeDemo = this.config.get<string>('MALICIOUS_IP_INCLUDE_DEMO') !== 'false';
    const demo = includeDemo
      ? ['192.0.2.100', '198.51.100.50', '203.0.113.25'] // TEST-NET-* (documentation only)
      : [];

    return [...demo, ...fromEnv];
  }

  private normalizeIpv4(ip: string | undefined): string | undefined {
    if (!ip?.trim()) return undefined;
    let t = ip.trim().replace(/^::ffff:/i, '');
    if (t.includes(',')) t = t.split(',')[0].trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return undefined;
    const parts = t.split('.').map((p) => Number(p));
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return undefined;
    return parts.join('.');
  }
}
