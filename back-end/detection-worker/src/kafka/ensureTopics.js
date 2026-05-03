const config = require('../config');
const { createKafka } = require('./kafkaFactory');

/**
 * Create log + alert topics if missing (local dev). Skips topics that already exist.
 */
async function ensureKafkaTopics() {
  const kafka = createKafka({
    clientId: `${config.kafka.clientId}-admin`,
    brokers: config.kafka.brokers,
  });
  const admin = kafka.admin();

  const rf = Math.max(
    1,
    Number.parseInt(process.env.KAFKA_TOPIC_REPLICATION_FACTOR || '1', 10) || 1
  );

  const desired = [
    { topic: config.kafka.rawLogsTopic, numPartitions: 1, replicationFactor: rf },
    { topic: config.kafka.alertsTopic, numPartitions: 1, replicationFactor: rf },
  ];

  try {
    await admin.connect();
    const existing = new Set(await admin.listTopics());
    const toCreate = desired.filter((t) => !existing.has(t.topic));
    if (toCreate.length === 0) {
      console.log('[kafka-admin] topics already exist:', desired.map((t) => t.topic).join(', '));
      return;
    }
    await admin.createTopics({ topics: toCreate, waitForLeaders: true });
    console.log('[kafka-admin] created topics:', toCreate.map((t) => t.topic).join(', '));
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // ignore
    }
  }
}

module.exports = { ensureKafkaTopics };
