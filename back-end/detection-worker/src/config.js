
require('dotenv').config();

const toInt = (value, defaultValue) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const brokersFromEnv = (value) => {
  const brokers = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return brokers.length ? brokers : ['localhost:9092'];
};

const config = Object.freeze({
  kafka: {
    clientId: 'smartsiem-detection-worker',
    brokers: brokersFromEnv(process.env.KAFKA_BROKERS),
    rawLogsTopic: process.env.RAW_LOGS_TOPIC || 'raw.logs',
    alertsTopic: process.env.ALERTS_TOPIC || 'alerts',
    consumerGroupId: process.env.CONSUMER_GROUP_ID || 'detection-workers',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smartsiem',
    /** Same DB as SmartSIEM-Collector Mongo path (`client["SIEM"]`) when using Atlas. */
    dbName: process.env.MONGODB_DB_NAME || 'smartsiem',
    collections: {
      logEvents: 'log_events',
      alerts: 'alerts',
      rules: 'detection_rules',
      stats: 'aggregated_stats',
      recommendations: 'recommendations',
    },
  },
  worker: {
    port: toInt(process.env.WORKER_PORT, 4000),
    flushIntervalMs: toInt(process.env.FLUSH_INTERVAL_MS, 5000),
    batchSize: toInt(process.env.BATCH_SIZE, 100),
    ruleReloadIntervalSec: toInt(process.env.RULE_RELOAD_INTERVAL_SEC, 60),
    statsIntervalMs: 600000,
    iocRefreshIntervalMs: 14400000,
  },
  /**
   * When `jwtSecret` is non-empty, dashboard API routes require
   * `Authorization: Bearer <access_token>` minted by SmartSIEM-Collector
   * (same secret + issuer as collector `auth_jwt_secret` / `auth_jwt_issuer`).
   * Leave empty for local dev with an open API.
   */
  auth: {
    jwtSecret: (process.env.AUTH_JWT_SECRET || '').trim(),
    jwtIssuer: process.env.AUTH_JWT_ISSUER || 'smartsiem-collector',
  },
});

module.exports = config;


