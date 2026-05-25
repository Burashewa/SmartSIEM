export type IngestRequestLike = {
  ip?: string;
  secure?: boolean;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export function getClientIp(request: IngestRequestLike): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  const ip = request.ip || request.socket?.remoteAddress || '';
  return normalizeIp(ip);
}

export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

export function isSecureRequest(request: IngestRequestLike): boolean {
  if (request.secure) return true;
  const proto = request.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

export function parseAllowedIpList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((entry) => normalizeIp(entry.trim()))
    .filter(Boolean);
}

export function isIpAllowed(clientIp: string, allowedList: string[]): boolean {
  if (allowedList.length === 0) return true;
  const normalized = normalizeIp(clientIp);
  return allowedList.some((allowed) => normalizeIp(allowed) === normalized);
}
