import { Injectable, Logger } from '@nestjs/common';

export interface IpGeoLocation {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  isp?: string;
  source: 'context' | 'ip-api' | 'ipwho' | 'private' | 'unknown';
}

interface IpApiResponse {
  status?: string;
  message?: string;
  query?: string;
  city?: string;
  regionName?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  isp?: string;
}

const FETCH_TIMEOUT_MS = 12_000;

@Injectable()
export class IpGeolocationService {
  private readonly logger = new Logger(IpGeolocationService.name);
  private readonly cache = new Map<string, IpGeoLocation>();
  /** One in-flight lookup per public IP to avoid duplicate requests and log spam. */
  private readonly pending = new Map<string, Promise<IpGeoLocation>>();

  async locate(ip: string | undefined, context?: Record<string, unknown>): Promise<IpGeoLocation | undefined> {
    const normalizedIp = this.normalizeIp(ip);
    if (!normalizedIp) return undefined;

    const fromContext = this.fromContext(normalizedIp, context);
    if (fromContext) {
      this.cache.set(normalizedIp, fromContext);
      return fromContext;
    }

    const cached = this.cache.get(normalizedIp);
    if (cached) return cached;

    if (this.isPrivateIp(normalizedIp)) {
      const privateLocation: IpGeoLocation = {
        ip: normalizedIp,
        country: 'Private network',
        source: 'private',
      };
      this.cache.set(normalizedIp, privateLocation);
      return privateLocation;
    }

    let inflight = this.pending.get(normalizedIp);
    if (!inflight) {
      inflight = this.resolvePublicIp(normalizedIp).finally(() => {
        this.pending.delete(normalizedIp);
      });
      this.pending.set(normalizedIp, inflight);
    }
    return inflight;
  }

  private async resolvePublicIp(normalizedIp: string): Promise<IpGeoLocation> {
    const errors: string[] = [];

    try {
      const loc = await this.lookupIpWho(normalizedIp);
      this.cache.set(normalizedIp, loc);
      return loc;
    } catch (e) {
      errors.push(`ipwho: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    try {
      const loc = await this.lookupIpApi(normalizedIp);
      this.cache.set(normalizedIp, loc);
      return loc;
    } catch (e) {
      errors.push(`ip-api: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    this.logger.debug(`Unable to geolocate ${normalizedIp}: ${errors.join('; ')}`);
    const unknownLocation: IpGeoLocation = {
      ip: normalizedIp,
      source: 'unknown',
    };
    this.cache.set(normalizedIp, unknownLocation);
    return unknownLocation;
  }

  /** HTTPS — works when outbound HTTP (ip-api) is blocked by proxy/firewall. */
  private async lookupIpWho(ip: string): Promise<IpGeoLocation> {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SmartSIEM/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`ipwho returned ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.success !== true) {
      const msg = typeof data.message === 'string' ? data.message : 'lookup failed';
      throw new Error(msg);
    }

    const connection = this.readRecord(data.connection);

    const location: IpGeoLocation = {
      ip: this.readString(data.ip) ?? ip,
      city: this.readString(data.city),
      region: this.readString(data.region),
      country: this.readString(data.country),
      countryCode: this.readString(data.country_code),
      lat: this.readNumber(data.latitude),
      lng: this.readNumber(data.longitude),
      isp: connection ? this.readString(connection.isp) : undefined,
      source: 'ipwho',
    };

    if (!location.country && !location.countryCode) {
      throw new Error('no country in response');
    }

    return location;
  }

  private async lookupIpApi(ip: string): Promise<IpGeoLocation> {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,query`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'SmartSIEM/1.0' },
      },
    );
    if (!response.ok) {
      throw new Error(`ip-api returned ${response.status}`);
    }

    const data = (await response.json()) as IpApiResponse;
    if (data.status !== 'success') {
      throw new Error(data.message ?? 'lookup failed');
    }

    const location: IpGeoLocation = {
      ip: data.query ?? ip,
      city: this.readString(data.city),
      region: this.readString(data.regionName),
      country: this.readString(data.country),
      countryCode: this.readString(data.countryCode),
      lat: this.readNumber(data.lat),
      lng: this.readNumber(data.lon),
      isp: this.readString(data.isp),
      source: 'ip-api',
    };

    return location;
  }

  private fromContext(ip: string, context?: Record<string, unknown>): IpGeoLocation | undefined {
    if (!context) return undefined;

    const geo = this.readRecord(context.geo) ?? this.readRecord(context.location);
    const lat =
      this.readNumber(context.latitude) ??
      this.readNumber(context.lat) ??
      this.readNumber(geo?.lat) ??
      this.readNumber(geo?.latitude);
    const lng =
      this.readNumber(context.longitude) ??
      this.readNumber(context.lng) ??
      this.readNumber(context.lon) ??
      this.readNumber(geo?.lng) ??
      this.readNumber(geo?.lon) ??
      this.readNumber(geo?.longitude);

    const city = this.readString(context.city) ?? this.readString(geo?.city);
    const country = this.readString(context.country) ?? this.readString(geo?.country);
    const region = this.readString(context.region) ?? this.readString(geo?.region);

    if (lat === undefined && lng === undefined && !city && !country && !region) {
      return undefined;
    }

    return {
      ip,
      city,
      region,
      country,
      lat,
      lng,
      isp: this.readString(context.isp) ?? this.readString(geo?.isp),
      source: 'context',
    };
  }

  private normalizeIp(ip: string | undefined): string | undefined {
    if (!ip?.trim()) return undefined;
    const cleaned = ip.trim().replace(/^::ffff:/, '');
    return cleaned.includes(',') ? cleaned.split(',')[0].trim() : cleaned;
  }

  private isPrivateIp(ip: string): boolean {
    if (ip === 'localhost' || ip === '::1') return true;
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
    const [first, second] = parts;
    return (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 127 ||
      (first === 169 && second === 254)
    );
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
