/**
 * Validates SmartSIEM access JWTs using the same contract as the collector
 * (`auth/security.py`: HS256, issuer claim, `type: "access"`, non-empty `sub`).
 */

const jwt = require('jsonwebtoken');

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string | null}
 */
function getBearerToken(req) {
  const raw = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== 'bearer') return null;
  const token = parts[1].trim();
  return token || null;
}

/**
 * @param {string} token
 * @param {{ secret: string, issuer: string }} opts
 * @returns {import('jsonwebtoken').JwtPayload}
 */
function verifyAccessToken(token, opts) {
  const { secret, issuer } = opts;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }
  /** @type {import('jsonwebtoken').JwtPayload} */
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer,
  });
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Invalid token subject');
  }
  return payload;
}

/**
 * @param {string} pathname URL pathname (no query string)
 * @returns {boolean}
 */
function pathRequiresJwt(pathname) {
  if (pathname === '/' || pathname === '/health' || pathname === '/stats') return false;
  if (
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/rules') ||
    pathname.startsWith('/logs') ||
    pathname.startsWith('/stats/') ||
    pathname.startsWith('/recommendations')
  ) {
    return true;
  }
  return false;
}

module.exports = {
  getBearerToken,
  verifyAccessToken,
  pathRequiresJwt,
};
