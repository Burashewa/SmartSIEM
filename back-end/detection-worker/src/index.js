const config = require('./config');
const { startConsumer, stopConsumer, getConsumerLag } = require('./kafka/consumer');
const { ensureKafkaTopics } = require('./kafka/ensureTopics');
const { connectProducer, disconnectProducer } = require('./kafka/producer');
const { connectMongo, disconnectMongo, getDb } = require('./storage/mongoWriter');
const { computeAndStoreStats } = require('./storage/statsAggregator');
const { reloadRules, getCurrentRules } = require('./rules/ruleLoader');
const { DetectionEngine } = require('./detection/engine');
const { startHealthServer, stopHealthServer } = require('./health/server');

let engine = null;
const periodicTimers = [];

async function start() {
  console.log('[worker] starting SmartSIEM detection worker...');

  const db = await connectMongo();
  if (!db) {
    console.error('[worker] MongoDB connection failed, exiting');
    process.exit(1);
  }

  const producerOk = await connectProducer();
  if (!producerOk) {
    console.error('[worker] Kafka producer connection failed, exiting');
    await disconnectMongo();
    process.exit(1);
  }

  try {
    await ensureKafkaTopics();
  } catch (err) {
    console.error('[worker] Kafka topic setup failed:', err?.message || err);
    console.error(
      '[worker] Create topics manually, e.g. normalized-logs and alerts on',
      config.kafka.brokers.join(',')
    );
    await disconnectProducer();
    await disconnectMongo();
    process.exit(1);
  }

  await reloadRules();

  engine = new DetectionEngine();
  startHealthServer({
    engine,
    getConsumerLag,
    getDb,
    getCurrentRules,
    reloadRules,
  });

  periodicTimers.push(
    setInterval(() => {
      void reloadRules();
    }, config.worker.ruleReloadIntervalSec * 1000)
  );
  periodicTimers.push(
    setInterval(() => {
      void engine.runHourlyStats();
    }, 3600000)
  );
  periodicTimers.push(
    setInterval(() => {
      engine.cleanup();
    }, 300000)
  );
  periodicTimers.push(
    setInterval(() => {
      void engine.threatIntelDetector.refresh();
    }, config.worker.iocRefreshIntervalMs)
  );
  periodicTimers.push(
    setInterval(() => {
      void computeAndStoreStats(getDb(), engine);
    }, config.worker.statsIntervalMs)
  );

  await startConsumer(async (event) => {
    await engine.processEvent(event);
  });

  console.log('Worker service started successfully');
}

async function shutdown() {
  console.log('[worker] shutdown signal received, stopping...');

  for (const t of periodicTimers) {
    clearInterval(t);
  }
  periodicTimers.length = 0;

  try {
    await stopConsumer();
  } catch (err) {
    console.error('[worker] stopConsumer error', err);
  }

  try {
    await computeAndStoreStats(getDb(), engine);
  } catch (err) {
    console.error('[worker] final stats aggregation error', err);
  }

  try {
    if (engine) await engine.shutdown();
  } catch (err) {
    console.error('[worker] engine.shutdown error', err);
  }

  try {
    await disconnectProducer();
  } catch (err) {
    console.error('[worker] disconnectProducer error', err);
  }

  try {
    await disconnectMongo();
  } catch (err) {
    console.error('[worker] disconnectMongo error', err);
  }

  try {
    await stopHealthServer();
  } catch (err) {
    console.error('[worker] stopHealthServer error', err);
  }

  process.exit(0);
}

process.once('SIGTERM', () => {
  void shutdown();
});
process.once('SIGINT', () => {
  void shutdown();
});

start().catch((err) => {
  console.error('[worker] fatal startup error', err);
  process.exit(1);
});
