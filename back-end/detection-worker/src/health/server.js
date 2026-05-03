const http = require('http');
const config = require('../config');

let server = null;
/** @type {HealthServerDeps | null} */
let deps = null;

/**
 * @typedef {object} HealthServerDeps
 * @property {{ totalProcessed?: number, totalAlerts?: number } | null} [engine]
 * @property {() => Promise<object>} [getConsumerLag]
 * @property {() => import('mongodb').Db | null} [getDb]
 * @property {() => unknown[]} [getCurrentRules]
 */

/**
 * @param {HealthServerDeps} options
 */
function startHealthServer(options) {
  if (server) return;

  deps = options || {};

  server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  server.listen(config.worker.port, () => {
    console.log(`[health] listening on port ${config.worker.port}`);
  });
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handleRequest(req, res) {
  const path = (req.url || '').split('?')[0];

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        totalProcessed: deps?.engine?.totalProcessed ?? 0,
        totalAlerts: deps?.engine?.totalAlerts ?? 0,
      })
    );
    return;
  }

  if (path === '/stats') {
    const rules = typeof deps?.getCurrentRules === 'function' ? deps.getCurrentRules() : [];
    const activeRules = Array.isArray(rules) ? rules.length : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        totalEventsProcessed: deps?.engine?.totalProcessed ?? 0,
        totalAlertsGenerated: deps?.engine?.totalAlerts ?? 0,
        activeRules,
        uptime: process.uptime(),
      })
    );
    return;
  }

  if (path === '/health') {
    try {
      let consumerLag = {};
      try {
        consumerLag =
          typeof deps?.getConsumerLag === 'function' ? await deps.getConsumerLag() : {};
      } catch (err) {
        console.error('[health] getConsumerLag error', err);
        consumerLag = { error: err instanceof Error ? err.message : String(err) };
      }

      let mongodb = { connected: false };
      try {
        const db = typeof deps?.getDb === 'function' ? deps.getDb() : null;
        if (db) {
          await db.admin().ping();
          mongodb = { connected: true };
        }
      } catch (err) {
        console.error('[health] mongodb ping error', err);
        mongodb = { connected: false };
      }

      const kafkaDegraded =
        consumerLag && typeof consumerLag === 'object' && 'error' in consumerLag;
      const status =
        mongodb.connected && !kafkaDegraded ? 'ok' : 'degraded';

      const payload = {
        status,
        uptime: process.uptime(),
        kafka: {
          consumerLag,
        },
        mongodb,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    } catch (err) {
      console.error('[health] /health handler error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'degraded',
          uptime: process.uptime(),
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        })
      );
    }
    return;
  }

  res.writeHead(404);
  res.end();
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
      console.log('[health] server stopped');
      resolve();
    });
  });
}

module.exports = {
  startHealthServer,
  stopHealthServer,
};
