import { Injectable } from '@nestjs/common';
import { deriveRuleFacingEvent } from '../derive-rule-event';
import { CreateLogDto } from '../log.dto';
import { NormalizedLog, Severity } from '../log.types';
import { LogParser } from './log-parser.interface';

@Injectable()
export class GenericLogParser implements LogParser {
  canParse(_dto: CreateLogDto): boolean {
    return true;
  }

  parse(dto: CreateLogDto): NormalizedLog[] {
    const rawEvents = this.extractRawEvents(dto);
    if (rawEvents.length === 0) {
      return [this.normalizeSingle(dto)];
    }

    return rawEvents.map((rawEvent) => this.normalizeFromRawEvent(dto, rawEvent));
  }

  private normalizeSeverity(value?: string): Severity {
    const v = (value || '').toLowerCase();
    if (v === 'critical') return 'critical';
    if (v === 'high') return 'high';
    if (v === 'medium') return 'medium';
    return 'low';
  }

  private normalizeEvent(value?: string): string | undefined {
    if (!value) return undefined;
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private normalizeTags(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out = value
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x !== '');
    return out.length ? out : undefined;
  }

  private readNullableResource(value: unknown): string | null | undefined {
    if (value === null) return null;
    if (typeof value === 'string') {
      const t = value.trim();
      return t === '' ? undefined : t;
    }
    return undefined;
  }

  private readResourceField(dto: CreateLogDto): string | null | undefined {
    const dtoAny = dto as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(dtoAny, 'resource')) return undefined;
    return this.readNullableResource(dtoAny.resource);
  }

  private resolveRaw(dto: CreateLogDto): Record<string, unknown> {
    const dtoAny = dto as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(dtoAny, 'raw')) {
      const pr = this.readRecord(dtoAny.raw);
      return pr ? { ...pr } : {};
    }
    return { ...dtoAny };
  }

  private resolveMetadata(dto: CreateLogDto): Record<string, unknown> | undefined {
    const dtoAny = dto as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(dtoAny, 'metadata')) return undefined;
    const m = this.readRecord(dtoAny.metadata);
    return m ? { ...m } : {};
  }

  private resolvePayload(dto: CreateLogDto): Record<string, unknown> | undefined {
    const p = this.readRecord((dto as Record<string, unknown>).payload);
    return p ? { ...p } : undefined;
  }

  private normalizeSingle(dto: CreateLogDto): NormalizedLog {
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const source = typeof dto.source === 'string' && dto.source.trim() !== '' ? dto.source : 'unknown';
    const severity = this.normalizeSeverity(dto.severity);

    const rawEventName = this.normalizeEvent(this.readString(dto.event)) ?? 'unknown';
    const action = this.normalizeEvent(this.readString(dto.action));
    const status = this.normalizeEvent(this.readString(dto.status));
    const event = deriveRuleFacingEvent(rawEventName, action, status);

    const user = typeof dto.user === 'string' && dto.user.trim() !== '' ? dto.user : undefined;
    const role = typeof dto.role === 'string' && dto.role.trim() !== '' ? dto.role : undefined;
    const ip = typeof dto.ip === 'string' && dto.ip.trim() !== '' ? dto.ip : undefined;
    const deviceId =
      typeof dto.deviceId === 'string' && dto.deviceId.trim() !== '' ? dto.deviceId : undefined;
    const sessionId =
      typeof dto.sessionId === 'string' && dto.sessionId.trim() !== '' ? dto.sessionId : undefined;
    const endpoint =
      typeof dto.endpoint === 'string' && dto.endpoint.trim() !== '' ? dto.endpoint : undefined;
    const method = typeof dto.method === 'string' && dto.method.trim() !== '' ? dto.method : undefined;
    const userAgent =
      typeof dto.userAgent === 'string' && dto.userAgent.trim() !== '' ? dto.userAgent : undefined;

    const resource = this.readResourceField(dto);
    const payload = this.resolvePayload(dto);
    const tags = this.normalizeTags((dto as Record<string, unknown>).tags);
    const metadata = this.resolveMetadata(dto);

    const geo = this.extractGeoFromRecord(dto as Record<string, unknown>);
    const raw = this.resolveRaw(dto);

    const out: NormalizedLog = {
      timestamp,
      source,
      severity,
      event,
      ...(action ? { action } : {}),
      ...(status ? { status } : {}),
      ...(user ? { user } : {}),
      ...(role ? { role } : {}),
      ...(ip ? { ip } : {}),
      ...(deviceId ? { deviceId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(endpoint ? { endpoint } : {}),
      ...(method ? { method } : {}),
      ...(resource !== undefined ? { resource } : {}),
      ...(payload ? { payload } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(geo?.latitude !== undefined ? { latitude: geo.latitude } : {}),
      ...(geo?.longitude !== undefined ? { longitude: geo.longitude } : {}),
      ...(tags ? { tags } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      raw,
    };

    return out;
  }

  private normalizeFromRawEvent(dto: CreateLogDto, rawEvent: Record<string, unknown>): NormalizedLog {
    const eventTimestamp = this.readString(rawEvent.ts);
    const eventLevel = this.readString(rawEvent.level);
    const eventName = this.readString(rawEvent.event);
    const action = this.normalizeEvent(this.readString(rawEvent.action));
    const status = this.normalizeEvent(this.readString(rawEvent.status));

    const context = this.readRecord(rawEvent.context);
    const contextEmail = this.readString(context?.email);
    const contextUser = this.readString(context?.user);
    const contextIp = this.readString(context?.clientIp);
    const geo =
      this.extractGeoFromRecord(rawEvent) ?? this.extractGeoFromRecord(dto as Record<string, unknown>);

    const timestamp = eventTimestamp ? new Date(eventTimestamp) : dto.timestamp ? new Date(dto.timestamp) : new Date();
    const source = typeof dto.source === 'string' && dto.source.trim() !== '' ? dto.source : 'unknown';
    const severity = this.normalizeSeverity(eventLevel || dto.severity);

    const rawEventName =
      this.normalizeEvent(eventName) ?? this.normalizeEvent(this.readString(dto.event)) ?? 'unknown';
    const dtoAction = this.normalizeEvent(this.readString(dto.action));
    const dtoStatus = this.normalizeEvent(this.readString(dto.status));
    const event = deriveRuleFacingEvent(rawEventName, action ?? dtoAction, status ?? dtoStatus);

    const user =
      typeof dto.user === 'string' && dto.user.trim() !== '' ? dto.user : contextEmail || contextUser || undefined;
    const ip = typeof dto.ip === 'string' && dto.ip.trim() !== '' ? dto.ip : contextIp || undefined;

    const raw: Record<string, unknown> = { ...dto, rawEvent };
    return {
      timestamp,
      source,
      severity,
      event,
      ...(user ? { user } : {}),
      ...(ip ? { ip } : {}),
      ...(geo?.latitude !== undefined ? { latitude: geo.latitude } : {}),
      ...(geo?.longitude !== undefined ? { longitude: geo.longitude } : {}),
      raw,
    };
  }

  private extractRawEvents(dto: CreateLogDto): Record<string, unknown>[] {
    const dtoAny = dto as Record<string, unknown>;
    const raw = this.readRecord(dtoAny.raw);
    const rawEvents = this.readArray(raw?.events);
    const topLevelEvents = this.readArray(dtoAny.events);

    const events = rawEvents.length > 0 ? rawEvents : topLevelEvents;
    return events.filter((event): event is Record<string, unknown> => this.isRecord(event));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined;
  }

  private readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private extractGeoFromRecord(record: Record<string, unknown>): { latitude: number; longitude: number } | undefined {
    const geo = this.readRecord(record.geo);
    const location = this.readRecord(record.location);
    const parsed = this.readRecord(record.parsed);
    const parsedGeo = this.readRecord(parsed?.geo);

    const latitude =
      this.readNumber(record.latitude) ??
      this.readNumber(record.lat) ??
      this.readNumber(geo?.latitude) ??
      this.readNumber(geo?.lat) ??
      this.readNumber(location?.latitude) ??
      this.readNumber(location?.lat) ??
      this.readNumber(parsedGeo?.latitude) ??
      this.readNumber(parsedGeo?.lat);

    const longitude =
      this.readNumber(record.longitude) ??
      this.readNumber(record.lon) ??
      this.readNumber(geo?.longitude) ??
      this.readNumber(geo?.lon) ??
      this.readNumber(location?.longitude) ??
      this.readNumber(location?.lon) ??
      this.readNumber(parsedGeo?.longitude) ??
      this.readNumber(parsedGeo?.lon);

    if (latitude === undefined || longitude === undefined) {
      return undefined;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return undefined;
    }

    return { latitude, longitude };
  }
}
