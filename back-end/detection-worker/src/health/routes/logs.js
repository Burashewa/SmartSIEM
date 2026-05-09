const config = require('../../config');
const { HttpError } = require('../router');

function parseInt32(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseDate(value) {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickList(value) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = raw.map((s) => String(s || '').trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function buildLogFilter(query) {
  const filter = {};

  const eventTypes = pickList(query.event_type);
  if (eventTypes) filter.event_type = { $in: eventTypes };

  if (query.source_ip) filter.source_ip = String(query.source_ip);
  if (query.user_id) filter.user_id = String(query.user_id);
  if (query.host) filter.host = String(query.host);

  if (query.q) {
    const q = String(query.q);
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { 'raw_data.message': { $regex: safe, $options: 'i' } },
      { event_type: { $regex: safe, $options: 'i' } },
      { source_ip: { $regex: safe, $options: 'i' } },
      { user_id: { $regex: safe, $options: 'i' } },
      { host: { $regex: safe, $options: 'i' } },
    ];
  }

  const since = parseDate(query.since);
  const until = parseDate(query.until);
  if (since || until) {
    filter.timestamp = {};
    if (since) filter.timestamp.$gte = since;
    if (until) filter.timestamp.$lte = until;
  }

  return filter;
}

/**
 * @param {import('../router').Router} router
 * @param {() => import('mongodb').Db | null} getDb
 */
function registerLogRoutes(router, getDb) {
  const collectionName = config.mongodb.collections.logEvents;

  const getCollection = () => {
    const db = getDb();
    if (!db) throw new HttpError(503, 'MongoDB unavailable');
    return db.collection(collectionName);
  };

  router.get('/logs', async (req) => {
    const limit = parseInt32(req.query.limit, 100, { min: 1, max: 1000 });
    const skip = parseInt32(req.query.offset, 0, { min: 0, max: 100000 });
    const filter = buildLogFilter(req.query);

    const coll = getCollection();

    // Time-series count is expensive at large scale; cap it for the UI.
    const COUNT_CAP = 100000;
    const [items, total] = await Promise.all([
      coll
        .find(filter, { projection: { _id: 0 } })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coll.countDocuments(filter, { limit: COUNT_CAP }),
    ]);

    return {
      items,
      total,
      total_capped: total >= COUNT_CAP,
      limit,
      offset: skip,
    };
  });

  router.get('/logs/sources', async () => {
    const coll = getCollection();
    const cursor = coll.aggregate(
      [
        {
          $group: {
            _id: '$event_type',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ],
      { allowDiskUse: true }
    );
    const rows = await cursor.toArray();
    return {
      items: rows.map((r) => ({ event_type: r._id || 'unknown', count: r.count })),
    };
  });
}

module.exports = { registerLogRoutes };
