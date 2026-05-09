const http = require('http');
const url = require('url');
const config = require('../config');
const { getBearerToken, verifyAccessToken, pathRequiresJwt } = require('../auth/jwt');
const { Router, sendJson, setCorsHeaders } = require('./router');
const { registerAlertRoutes } = require('./routes/alerts');
const { registerLogRoutes } = require('./routes/logs');
const { registerRuleRoutes } = require('./routes/rules');
const { registerStatsRoutes } = require('./routes/stats');

let server = null;
/** @type {HealthServerDeps | null} */
let deps = null;

/**
 * @typedef {object} HealthServerDeps
 * @property {{ totalProcessed?: number, totalAlerts?: number } | null} [engine]
 * @property {() => Promise<object>} [getConsumerLag]
 * @property {() => import('mongodb').Db | null} [getDb]
 * @property {() => unknown[]} [getCurrentRules]
 * @property {() => Promise<unknown[]>} [reloadRules]
 */

/**
 * @param {HealthServerDeps} options
 */
function startHealthServer(options) {
  if (server) return;

  deps = options || {};
  const router = buildRouter(deps);

  server = http.createServer((req, res) => {
    void handleRequest(req, res, router);
  });

  server.listen(config.worker.port, () => {
    console.log(`[api] listening on port ${config.worker.port}`);
    if (config.auth.jwtSecret) {
      console.log(
        `[api] JWT auth enabled for /alerts, /rules, /logs, /stats/*, /recommendations (issuer=${config.auth.jwtIssuer})`
      );
    } else {
      console.log('[api] JWT auth disabled (set AUTH_JWT_SECRET to match collector to require Bearer tokens)');
    }
  });
}

/**
 * @param {HealthServerDeps} d
 */
function buildRouter(d) {
  const router = new Router();

  // Legacy/health endpoints kept for compatibility with the dashboard.
  router.get('/', () => ({
    ok: true,
    totalProcessed: d?.engine?.totalProcessed ?? 0,
    totalAlerts: d?.engine?.totalAlerts ?? 0,
  }));

  router.get('/stats', () => {
    const rules = typeof d?.getCurrentRules === 'function' ? d.getCurrentRules() : [];
    const activeRules = Array.isArray(rules) ? rules.length : 0;
    return {
      totalEventsProcessed: d?.engine?.totalProcessed ?? 0,
      totalAlertsGenerated: d?.engine?.totalAlerts ?? 0,
      activeRules,
      uptime: process.uptime(),
    };
  });

  router.get('/health', async () => {
    let consumerLag = {};
    try {
      consumerLag =
        typeof d?.getConsumerLag === 'function' ? await d.getConsumerLag() : {};
    } catch (err) {
      console.error('[api] getConsumerLag error', err);
      consumerLag = { error: err instanceof Error ? err.message : String(err) };
    }

    let mongodb = { connected: false };
    try {
      const db = typeof d?.getDb === 'function' ? d.getDb() : null;
      if (db) {
        await db.admin().ping();
        mongodb = { connected: true };
      }
    } catch (err) {
      console.error('[api] mongodb ping error', err);
      mongodb = { connected: false };
    }

    const kafkaDegraded =
      consumerLag && typeof consumerLag === 'object' && 'error' in consumerLag;
    const status = mongodb.connected && !kafkaDegraded ? 'ok' : 'degraded';

    return {
      status,
      uptime: process.uptime(),
      kafka: { consumerLag },
      mongodb,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  });

  // Domain endpoints (Mongo-backed) for the dashboard.
  if (typeof d?.getDb === 'function') {
    registerAlertRoutes(router, d.getDb);
    registerLogRoutes(router, d.getDb);
    registerRuleRoutes(router, d.getDb, { reload: d?.reloadRules || (() => Promise.resolve([])) });
    registerStatsRoutes(router, d.getDb);
  }

  return router;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Router} router
 */
async function handleRequest(req, res, router) {
  try {
    const pathname = url.parse(req.url || '/', true).pathname || '/';
    const method = (req.method || 'GET').toUpperCase();

    if (method !== 'OPTIONS' && config.auth.jwtSecret && pathRequiresJwt(pathname)) {
      setCorsHeaders(res);
      const token = getBearerToken(req);
      if (!token) {
        sendJson(res, 401, { error: 'Missing Authorization header' });
        return;
      }
      try {
        verifyAccessToken(token, {
          secret: config.auth.jwtSecret,
          issuer: config.auth.jwtIssuer,
        });
      } catch (err) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String(/** @type {{ message: string }} */ (err).message)
            : 'Invalid token';
        sendJson(res, 401, { error: msg });
        return;
      }
    }

    const matched = await router.dispatch(req, res);
    if (matched) return;
    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[api] dispatch error', err);
    if (!res.writableEnded) {
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  }
}

function stopHealthServer() {
  return new Promise((resolve) => {
    if (!server) {
      deps = null;
      resolve();
      return;
    }
    server.close(() => {
      server = null;
      deps = null;
      console.log('[api] server stopped');
      resolve();
    });
  });
}

module.exports = {
  startHealthServer,
  stopHealthServer,
};
