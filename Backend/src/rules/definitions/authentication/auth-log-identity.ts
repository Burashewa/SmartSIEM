import { Model } from 'mongoose';
import { Log } from '../../../logs/log.schema';
import { FAILED_LOGIN_EVENT_NAMES } from '../../rules.constants';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  return value;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIdentity(value: unknown): string | undefined {
  const raw = readString(value);
  if (!raw) return undefined;
  return raw.toLowerCase();
}

function readIdentityFromContext(ctx: Record<string, unknown> | undefined): string | undefined {
  if (!ctx) return undefined;

  const direct =
    normalizeIdentity(ctx.email) ??
    normalizeIdentity(ctx.user) ??
    normalizeIdentity(ctx.username);
  if (direct) return direct;

  const body = readRecord(ctx.body);
  if (!body) return undefined;

  return (
    normalizeIdentity(body.email) ??
    normalizeIdentity(body.username) ??
    normalizeIdentity(body.user)
  );
}

function readIdentityFromRawContainer(container: Record<string, unknown> | undefined): string | undefined {
  if (!container) return undefined;

  const rawEvent = readRecord(container.rawEvent);
  if (rawEvent) {
    const fromEvent = readIdentityFromContext(readRecord(rawEvent.context));
    if (fromEvent) return fromEvent;
  }

  const events = Array.isArray(container.events) ? container.events : [];
  for (const ev of events) {
    if (!isRecord(ev)) continue;
    const fromEv = readIdentityFromContext(readRecord(ev.context));
    if (fromEv) return fromEv;
  }

  return undefined;
}

/**
 * Resolve the account targeted by a login attempt from normalized `user` or agent context fields.
 */
export function extractLoginIdentity(log: Log): string | undefined {
  const topLevel = normalizeIdentity(log.user);
  if (topLevel) return topLevel;

  const fromRaw = readIdentityFromRawContainer(readRecord(log.raw));
  if (fromRaw) return fromRaw;

  return readIdentityFromRawContainer(readRecord(log.payload));
}

export function isFailedLoginLog(log: { event?: string }): boolean {
  return Boolean(log.event && FAILED_LOGIN_EVENT_NAMES.includes(log.event));
}

export function userMatchFilter(identity: string): Record<string, unknown> {
  const pattern = `^${escapeRegex(identity)}$`;
  const rx = { $regex: pattern, $options: 'i' };
  return {
    $or: [
      { user: rx },
      { 'raw.rawEvent.context.email': rx },
      { 'raw.rawEvent.context.user': rx },
      { 'raw.rawEvent.context.username': rx },
      { 'raw.rawEvent.context.body.email': rx },
      { 'raw.rawEvent.context.body.username': rx },
      { 'raw.rawEvent.context.body.user': rx },
      { 'raw.events.context.email': rx },
      { 'raw.events.context.user': rx },
      { 'raw.events.context.body.email': rx },
      { 'raw.events.context.body.username': rx },
      { 'payload.rawEvent.context.email': rx },
      { 'payload.rawEvent.context.user': rx },
      { 'payload.rawEvent.context.body.email': rx },
      { 'payload.rawEvent.context.body.username': rx },
    ],
  };
}

export type CredentialStuffingStats = {
  uniqueIdentities: number;
  totalAttempts: number;
  identities: string[];
};

/**
 * Count distinct login identities for one IP in a time window (tenant-scoped).
 */
export async function countDistinctLoginIdentitiesFromIp(
  logModel: Model<Log>,
  log: Log,
  windowMinutes: number,
): Promise<CredentialStuffingStats> {
  if (!log.ip?.trim()) {
    return { uniqueIdentities: 0, totalAttempts: 0, identities: [] };
  }

  const windowStart = new Date(log.timestamp.getTime() - windowMinutes * 60 * 1000);
  const match: Record<string, unknown> = {
    ip: log.ip,
    event: { $in: FAILED_LOGIN_EVENT_NAMES },
    timestamp: { $gte: windowStart, $lte: log.timestamp },
  };
  if (log.userId != null) {
    match.userId = log.userId;
  }

  const docs = await logModel.find(match).select('user raw payload').lean().exec();
  return countIdentitiesFromDocuments(docs as unknown as Log[]);
}

/** Pure helper for unit tests and in-memory aggregation. */
export function countIdentitiesFromDocuments(docs: Log[]): CredentialStuffingStats {
  const identities = new Set<string>();

  for (const doc of docs) {
    const identity = extractLoginIdentity(doc);
    if (identity) identities.add(identity);
  }

  return {
    uniqueIdentities: identities.size,
    totalAttempts: docs.length,
    identities: [...identities].sort(),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
