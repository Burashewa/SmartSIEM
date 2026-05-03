const config = require('../config');

const TOP_LIMIT = 20;

function countsToTopList(countsObj, keyField) {
  return Object.entries(countsObj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([key, count]) => ({ [keyField]: key, count }));
}

/**
 * Takes in-memory interval counters from the engine, builds a summary document,
 * and upserts into aggregated_stats. Uses period + timestamp as the unique key.
 *
 * @param {import('mongodb').Db | null} db
 * @param {{ consumeIntervalStatsSnapshot: () => object } | null} engine
 */
async function computeAndStoreStats(db, engine) {
  try {
    if (!db || !engine || typeof engine.consumeIntervalStatsSnapshot !== 'function') return;

    const snapshot = engine.consumeIntervalStatsSnapshot();

    const intervalMs = Math.max(60000, Number(config.worker.statsIntervalMs) || 600000);
    const bucketStart = new Date(Math.floor(Date.now() / intervalMs) * intervalMs);

    const period = intervalMs === 600000 ? '10min' : `${Math.round(intervalMs / 60000)}min`;
    const timestamp = bucketStart.toISOString();

    const doc = {
      period,
      timestamp,
      total_logs: snapshot.total_logs,
      total_alerts: snapshot.total_alerts,
      alerts_by_severity: { ...snapshot.alerts_by_severity },
      top_source_ips: countsToTopList(snapshot.source_ip_counts, 'ip'),
      top_event_types: countsToTopList(snapshot.event_type_counts, 'type'),
    };

    const coll = db.collection(config.mongodb.collections.stats);
    await coll.updateOne({ period, timestamp }, { $set: doc }, { upsert: true });

    console.log(
      `[stats-aggregator] upserted aggregated_stats bucket=${timestamp} logs=${doc.total_logs} alerts=${doc.total_alerts}`
    );
  } catch (err) {
    console.error('[stats-aggregator] computeAndStoreStats error', err);
  }
}

module.exports = {
  computeAndStoreStats,
};
