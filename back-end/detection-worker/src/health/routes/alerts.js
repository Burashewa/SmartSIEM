const config = require('../../config');
const { HttpError } = require('../router');

const VALID_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'FALSE_POSITIVE'];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function parseInt32(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function pickList(value) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = raw
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function parseDate(value) {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildAlertFilter(query) {
  const filter = {};

  const severities = pickList(query.severity);
  if (severities) {
    const normalized = severities
      .map((s) => s.toUpperCase())
      .filter((s) => VALID_SEVERITIES.includes(s));
    if (normalized.length) filter.severity = { $in: normalized };
  }

  const statuses = pickList(query.status);
  if (statuses) {
    const normalized = statuses
      .map((s) => s.toUpperCase().replace(/-/g, '_'))
      .filter((s) => VALID_STATUSES.includes(s));
    if (normalized.length) filter.status = { $in: normalized };
  }

  if (query.rule_id) filter.rule_id = String(query.rule_id);
  if (query.event_type) filter.event_type = String(query.event_type);
  if (query.source_ip) filter.source_ip = String(query.source_ip);
  if (query.user_id) filter.user_id = String(query.user_id);

  if (query.q) {
    const q = String(query.q);
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { description: { $regex: safe, $options: 'i' } },
      { rule_name: { $regex: safe, $options: 'i' } },
      { rule_id: { $regex: safe, $options: 'i' } },
      { source_ip: { $regex: safe, $options: 'i' } },
    ];
  }

  const since = parseDate(query.since);
  const until = parseDate(query.until);
  if (since || until) {
    filter.trigger_time = {};
    if (since) filter.trigger_time.$gte = since.toISOString();
    if (until) filter.trigger_time.$lte = until.toISOString();
  }

  return filter;
}

/**
 * @param {import('../router').Router} router
 * @param {() => import('mongodb').Db | null} getDb
 */
function registerAlertRoutes(router, getDb) {
  const collectionName = config.mongodb.collections.alerts;

  const getCollection = () => {
    const db = getDb();
    if (!db) throw new HttpError(503, 'MongoDB unavailable');
    return db.collection(collectionName);
  };

  router.get('/alerts', async (req) => {
    const limit = parseInt32(req.query.limit, 50, { min: 1, max: 500 });
    const skip = parseInt32(req.query.offset, 0, { min: 0, max: 100000 });
    const filter = buildAlertFilter(req.query);

    const coll = getCollection();
    const [items, total] = await Promise.all([
      coll
        .find(filter, {
          projection: {
            _id: 0,
          },
        })
        .sort({ trigger_time: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coll.countDocuments(filter),
    ]);

    return { items, total, limit, offset: skip };
  });

  router.get('/alerts/summary', async (req) => {
    const since = parseDate(req.query.since);
    const filter = since ? { trigger_time: { $gte: since.toISOString() } } : {};

    const coll = getCollection();

    const [bySeverity, byStatus, total, openCount, recent] = await Promise.all([
      coll
        .aggregate([
          { $match: filter },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),
      coll.countDocuments(filter),
      coll.countDocuments({ ...filter, status: { $in: ['NEW', 'IN_PROGRESS'] } }),
      coll
        .find(filter, { projection: { _id: 0 } })
        .sort({ trigger_time: -1 })
        .limit(10)
        .toArray(),
    ]);

    const severityMap = Object.fromEntries(bySeverity.map((d) => [d._id || 'UNKNOWN', d.count]));
    const statusMap = Object.fromEntries(byStatus.map((d) => [d._id || 'UNKNOWN', d.count]));

    return {
      total,
      open: openCount,
      bySeverity: severityMap,
      byStatus: statusMap,
      recent,
    };
  });

  router.get('/alerts/:id', async (req) => {
    const coll = getCollection();
    const doc = await coll.findOne({ alert_id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) throw new HttpError(404, 'Alert not found');
    return doc;
  });

  router.patch('/alerts/:id', async (req) => {
    const body = (await req.bodyJson()) || {};
    /** @type {Record<string, any>} */
    const updates = {};

    if (body.status !== undefined) {
      const next = String(body.status).toUpperCase().replace(/-/g, '_');
      if (!VALID_STATUSES.includes(next)) {
        throw new HttpError(400, `Invalid status; expected one of ${VALID_STATUSES.join(', ')}`);
      }
      updates.status = next;
    }
    if (body.assignee !== undefined) updates.assignee = String(body.assignee || '') || null;
    if (body.notes !== undefined) updates.notes = String(body.notes || '') || null;

    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, 'No mutable fields provided');
    }
    updates.updated_at = new Date().toISOString();

    const coll = getCollection();
    const result = await coll.findOneAndUpdate(
      { alert_id: req.params.id },
      { $set: updates },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    const doc = result?.value ?? result;
    if (!doc || !doc.alert_id) throw new HttpError(404, 'Alert not found');
    return doc;
  });
}

module.exports = { registerAlertRoutes };
