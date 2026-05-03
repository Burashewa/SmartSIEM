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
  source: 'context' | 'ip-api' | 'private' | 'unknown';
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

@Injectable()
export class IpGeolocationService {
  private readonly logger = new Logger(IpGeolocationService.name);
  private readonly cache = new Map<string, IpGeoLocation>();

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

    try {
      const response = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(normalizedIp)}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,query`,
      );
      if (!response.ok) {
        throw new Error(`ip-api returned ${response.status}`);
      }

      const data = (await response.json()) as IpApiResponse;
      if (data.status !== 'success') {
        throw new Error(data.message ?? 'lookup failed');
      }

      const location: IpGeoLocation = {
        ip: data.query ?? normalizedIp,
        city: this.readString(data.city),
        region: this.readString(data.regionName),
        country: this.readString(data.country),
        countryCode: this.readString(data.countryCode),
        lat: this.readNumber(data.lat),
        lng: this.readNumber(data.lon),
        isp: this.readString(data.isp),
        source: 'ip-api',
      };

      this.cache.set(normalizedIp, location);
      return location;
    } catch (error) {
      this.logger.debug(
        `Unable to geolocate ${normalizedIp}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      const unknownLocation: IpGeoLocation = {
        ip: normalizedIp,
        source: 'unknown',
      };
      this.cache.set(normalizedIp, unknownLocation);
      return unknownLocation;
    }
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
