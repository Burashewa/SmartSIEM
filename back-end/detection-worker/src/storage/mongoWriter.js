
const { MongoClient } = require('mongodb');
const config = require('../config');

let client = null;
let db = null;

const COLLECTIONS = config.mongodb.collections;

async function ensureTimeSeriesLogEvents(database) {
  try {
    const existing = await database.listCollections({ name: COLLECTIONS.logEvents }).toArray();
    if (existing.length === 0) {
      await database.createCollection(COLLECTIONS.logEvents, {
        timeseries: {
          timeField: 'timestamp',
          metaField: 'source_ip',
          granularity: 'seconds',
        },
        expireAfterSeconds: 2592000,
      });
      return;
    }

    const info = existing[0];
    const isTimeSeries =
      info.type === 'timeseries' ||
      (info.options && (info.options.timeseries || info.options.timeSeries));

    if (!isTimeSeries) {
      console.warn(
        `[mongo] collection ${COLLECTIONS.logEvents} exists but is not time-series; leaving as-is`
      );
    }
  } catch (err) {
    console.error('[mongo] ensureTimeSeriesLogEvents error', err);
  }
}

async function ensureIndexes(database) {
  try {
    await database
      .collection(COLLECTIONS.alerts)
      .createIndex({ trigger_time: -1 }, { background: true });
    await database.collection(COLLECTIONS.alerts).createIndex({ rule_id: 1 }, { background: true });
    await database
      .collection(COLLECTIONS.logEvents)
      .createIndex({ timestamp: -1, source_ip: 1 }, { background: true });
  } catch (err) {
    console.error('[mongo] ensureIndexes error', err);
  }
}

async function connectMongo() {
  try {
    if (db) return db;

    client = new MongoClient(config.mongodb.uri);
    await client.connect();
    db = client.db(config.mongodb.dbName);

    await ensureTimeSeriesLogEvents(db);
    await ensureIndexes(db);

    console.log('[mongo] connected and ready');
    return db;
  } catch (err) {
    console.error('[mongo] connectMongo error', err);
    return null;
  }
}

async function disconnectMongo() {
  try {
    if (!client) return;
    await client.close();
    client = null;
    db = null;
    console.log('[mongo] disconnected');
  } catch (err) {
    console.error('[mongo] disconnectMongo error', err);
  }
}

/** Time-series `log_events` requires `timeField` as BSON Date, not an ISO string. */
function normalizeLogDocumentForTimeseries(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  if (out.timestamp == null) {
    out.timestamp = new Date();
  } else if (out.timestamp instanceof Date) {
    if (Number.isNaN(out.timestamp.getTime())) out.timestamp = new Date();
  } else if (typeof out.timestamp === 'string' || typeof out.timestamp === 'number') {
    const d = new Date(out.timestamp);
    out.timestamp = Number.isNaN(d.getTime()) ? new Date() : d;
  } else {
    out.timestamp = new Date();
  }
  return out;
}

function isDuplicateKeyError(err) {
  if (!err) return false;
  if (err.code === 11000) return true;
  if (Array.isArray(err.writeErrors) && err.writeErrors.some((e) => e?.code === 11000)) return true;
  if (Array.isArray(err?.result?.writeErrors) && err.result.writeErrors.some((e) => e?.code === 11000))
    return true;
  return false;
}

async function batchWriteLogs(logArray) {
  try {
    if (!Array.isArray(logArray) || logArray.length === 0) return;
    if (!db) await connectMongo();
    if (!db) return;

    try {
      const prepared = logArray.map((doc) => normalizeLogDocumentForTimeseries(doc));
      const result = await db
        .collection(COLLECTIONS.logEvents)
        .insertMany(prepared, { ordered: false });
      console.log(`[mongo] wrote ${result.insertedCount} logs`);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const inserted = err?.result?.insertedCount ?? 0;
        console.log(`[mongo] wrote ${inserted} logs (duplicates ignored)`);
        return;
      }
      console.error('[mongo] batchWriteLogs error', err);
    }
  } catch (err) {
    console.error('[mongo] batchWriteLogs unexpected error', err);
  }
}

async function batchWriteAlerts(alertArray) {
  try {
    if (!Array.isArray(alertArray) || alertArray.length === 0) return;
    if (!db) await connectMongo();
    if (!db) return;

    try {
      const result = await db
        .collection(COLLECTIONS.alerts)
        .insertMany(alertArray, { ordered: false });
      console.log(`[mongo] wrote ${result.insertedCount} alerts`);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const inserted = err?.result?.insertedCount ?? 0;
        console.log(`[mongo] wrote ${inserted} alerts (duplicates ignored)`);
        return;
      }
      console.error('[mongo] batchWriteAlerts error', err);
    }
  } catch (err) {
    console.error('[mongo] batchWriteAlerts unexpected error', err);
  }
}

function getDb() {
  return db;
}

module.exports = {
  connectMongo,
  disconnectMongo,
  batchWriteLogs,
  batchWriteAlerts,
  getDb,
};


