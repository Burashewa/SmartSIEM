const config = require('../../config');
const { HttpError } = require('../router');

function parseInt32(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {import('../router').Router} router
 * @param {() => import('mongodb').Db | null} getDb
 */
function registerStatsRoutes(router, getDb) {
  const collectionName = config.mongodb.collections.stats;

  const getCollection = () => {
    const db = getDb();
    if (!db) throw new HttpError(503, 'MongoDB unavailable');
    return db.collection(collectionName);
  };

  /**
   * Returns time-series buckets from `aggregated_stats`.
   * Query params: period (default `10min`), points (default 24, max 200).
   */
  router.get('/stats/timeseries', async (req) => {
    const period = String(req.query.period || '10min');
    const points = parseInt32(req.query.points, 24, { min: 1, max: 200 });

    const coll = getCollection();
    const items = await coll
      .find({ period }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .limit(points)
      .toArray();

    return { period, items: items.reverse() };
  });

  /**
   * Returns the most recent aggregated_stats document plus a derived overview.
   */
  router.get('/stats/summary', async (req) => {
    const period = String(req.query.period || '10min');
    const coll = getCollection();
    const latest = await coll
      .find({ period }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    return {
      period,
      latest,
    };
  });

  router.get('/recommendations', async (req) => {
    const db = getDb();
    if (!db) throw new HttpError(503, 'MongoDB unavailable');
    const limit = parseInt32(req.query.limit, 100, { min: 1, max: 500 });
    const items = await db
      .collection(config.mongodb.collections.recommendations)
      .find({}, { projection: { _id: 0 } })
      .limit(limit)
      .toArray();
    return { items, total: items.length };
  });
}

module.exports = { registerStatsRoutes };
