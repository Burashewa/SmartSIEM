const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { HttpError } = require('../router');

const VALID_TYPES = ['threshold', 'pattern', 'statistical', 'sequence'];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const VALID_STATUSES = ['ACTIVE', 'DISABLED'];

function sanitizeStatus(value) {
  const s = String(value || '').toUpperCase();
  if (!VALID_STATUSES.includes(s)) {
    throw new HttpError(400, `Invalid status; expected one of ${VALID_STATUSES.join(', ')}`);
  }
  return s;
}

function sanitizeSeverity(value) {
  const s = String(value || '').toUpperCase();
  if (!VALID_SEVERITIES.includes(s)) {
    throw new HttpError(400, `Invalid severity; expected one of ${VALID_SEVERITIES.join(', ')}`);
  }
  return s;
}

function sanitizeType(value) {
  const s = String(value || '').toLowerCase();
  if (!VALID_TYPES.includes(s)) {
    throw new HttpError(400, `Invalid type; expected one of ${VALID_TYPES.join(', ')}`);
  }
  return s;
}

function buildRuleFromBody(body, { isCreate }) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  /** @type {Record<string, any>} */
  const out = {};

  if (isCreate) {
    out.rule_id = body.rule_id ? String(body.rule_id) : `rule-${uuidv4()}`;
  }

  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new HttpError(400, 'name is required');
    out.name = String(body.name).trim();
  } else if (isCreate) {
    throw new HttpError(400, 'name is required');
  }

  if (body.description !== undefined) {
    out.description = String(body.description || '');
  }

  if (body.type !== undefined) {
    out.type = sanitizeType(body.type);
  } else if (isCreate) {
    throw new HttpError(400, 'type is required');
  }

  if (body.severity !== undefined) {
    out.severity = sanitizeSeverity(body.severity);
  } else if (isCreate) {
    out.severity = 'MEDIUM';
  }

  if (body.event_type !== undefined) {
    out.event_type = String(body.event_type || '').trim();
  }

  if (body.status !== undefined) {
    out.status = sanitizeStatus(body.status);
  } else if (isCreate) {
    out.status = 'ACTIVE';
  }

  if (body.config !== undefined) {
    if (body.config === null || typeof body.config !== 'object') {
      throw new HttpError(400, 'config must be an object');
    }
    out.config = body.config;
  } else if (isCreate) {
    out.config = {};
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new HttpError(400, 'tags must be an array of strings');
    out.tags = body.tags.map((t) => String(t));
  }

  return out;
}

/**
 * @param {import('../router').Router} router
 * @param {() => import('mongodb').Db | null} getDb
 * @param {{ reload: () => Promise<unknown[]> }} ruleCtl
 */
function registerRuleRoutes(router, getDb, ruleCtl) {
  const collectionName = config.mongodb.collections.rules;

  const getCollection = () => {
    const db = getDb();
    if (!db) throw new HttpError(503, 'MongoDB unavailable');
    return db.collection(collectionName);
  };

  router.get('/rules', async (req) => {
    const includeInactive = String(req.query.include_inactive || '').toLowerCase() === 'true';
    const filter = includeInactive ? {} : { status: 'ACTIVE' };
    const coll = getCollection();
    const items = await coll
      .find(filter, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();
    return { items, total: items.length };
  });

  router.get('/rules/:id', async (req) => {
    const coll = getCollection();
    const doc = await coll.findOne({ rule_id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) throw new HttpError(404, 'Rule not found');
    return doc;
  });

  router.post('/rules', async (req, res) => {
    const body = await req.bodyJson();
    const doc = buildRuleFromBody(body, { isCreate: true });
    doc.created_at = new Date().toISOString();
    doc.updated_at = doc.created_at;

    const coll = getCollection();
    try {
      await coll.insertOne(doc);
    } catch (err) {
      if (err && err.code === 11000) {
        throw new HttpError(409, 'A rule with this rule_id already exists');
      }
      throw err;
    }

    if (ruleCtl?.reload) {
      void ruleCtl.reload();
    }
    res.json(201, doc);
  });

  router.patch('/rules/:id', async (req) => {
    const body = await req.bodyJson();
    const updates = buildRuleFromBody(body, { isCreate: false });
    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, 'No mutable fields provided');
    }
    updates.updated_at = new Date().toISOString();

    const coll = getCollection();
    const result = await coll.findOneAndUpdate(
      { rule_id: req.params.id },
      { $set: updates },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    const doc = result?.value ?? result;
    if (!doc || !doc.rule_id) throw new HttpError(404, 'Rule not found');

    if (ruleCtl?.reload) {
      void ruleCtl.reload();
    }
    return doc;
  });

  router.delete('/rules/:id', async (req) => {
    const coll = getCollection();
    const result = await coll.deleteOne({ rule_id: req.params.id });
    if (result.deletedCount === 0) throw new HttpError(404, 'Rule not found');

    if (ruleCtl?.reload) {
      void ruleCtl.reload();
    }
    return { status: 'ok', rule_id: req.params.id };
  });

  router.post('/rules/reload', async () => {
    if (!ruleCtl?.reload) {
      throw new HttpError(503, 'Rule reload not available');
    }
    const reloaded = await ruleCtl.reload();
    return { status: 'ok', count: Array.isArray(reloaded) ? reloaded.length : 0 };
  });
}

module.exports = { registerRuleRoutes };
