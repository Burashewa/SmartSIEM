
const config = require('../config');
const { normalizeInboundKafkaMessage } = require('../adapt/collectorKafkaEvent');
const { createKafka } = require('./kafkaFactory');

const kafka = createKafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

const consumer = kafka.consumer({ groupId: config.kafka.consumerGroupId });

let isStarted = false;

async function startConsumer(messageHandler) {
  try {
    if (isStarted) return;
    if (typeof messageHandler !== 'function') {
      console.error('[kafka-consumer] startConsumer requires a messageHandler function');
      return;
    }

    await consumer.connect();
    console.log('[kafka-consumer] connected');

    await consumer.subscribe({ topic: config.kafka.rawLogsTopic, fromBeginning: false });
    console.log(`[kafka-consumer] subscribed to ${config.kafka.rawLogsTopic}`);

    await consumer.run({
      autoCommit: false,
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        commitOffsetsIfNecessary,
        isRunning,
        isStale,
      }) => {
        try {
          for (const message of batch.messages) {
            if (!isRunning() || isStale()) break;

            try {
              const raw = message.value ? message.value.toString('utf8') : '';
              const parsed = raw ? JSON.parse(raw) : null;
              const parsedEvent = normalizeInboundKafkaMessage(parsed);
              await messageHandler(parsedEvent);
            } catch (err) {
              console.error('[kafka-consumer] message processing error', err);
            } finally {
              // Always resolve so poison-pill messages don't stall the consumer.
              try {
                resolveOffset(message.offset);
              } catch (err) {
                console.error('[kafka-consumer] resolveOffset error', err);
              }
            }

            try {
              await heartbeat();
            } catch (err) {
              console.error('[kafka-consumer] heartbeat error', err);
            }
          }

          await commitOffsetsIfNecessary();
        } catch (err) {
          console.error('[kafka-consumer] batch processing error', err);
          // Commit anyway to avoid getting stuck on a bad batch.
          try {
            for (const message of batch.messages) {
              try {
                resolveOffset(message.offset);
              } catch {
                // ignore
              }
            }
            await commitOffsetsIfNecessary();
          } catch (commitErr) {
            console.error('[kafka-consumer] failed committing offsets after batch error', commitErr);
          }
        }
      },
    });

    isStarted = true;
  } catch (err) {
    console.error('[kafka-consumer] startConsumer connection error', err);
    throw err;
  }
}

async function stopConsumer() {
  try {
    if (!isStarted) return;
    await consumer.disconnect();
    isStarted = false;
    console.log('[kafka-consumer] disconnected');
  } catch (err) {
    console.error('[kafka-consumer] stopConsumer error', err);
  }
}

async function getConsumerLag() {
  const admin = kafka.admin();
  try {
    await admin.connect();

    const topic = config.kafka.rawLogsTopic;
    const groupId = config.kafka.consumerGroupId;

    const [latestOffsets, committedOffsets] = await Promise.all([
      admin.fetchTopicOffsets(topic),
      admin.fetchOffsets({ groupId, topic }),
    ]);

    const latestByPartition = new Map(
      latestOffsets.map((p) => [Number(p.partition), Number.parseInt(p.offset, 10)])
    );

    const partitions = {};
    let totalLag = 0;

    for (const p of committedOffsets) {
      const partition = Number(p.partition);
      const committed = Number.parseInt(p.offset, 10);
      const latest = latestByPartition.get(partition) ?? committed;

      const safeCommitted = Number.isFinite(committed) ? committed : 0;
      const safeLatest = Number.isFinite(latest) ? latest : safeCommitted;
      const lag = Math.max(0, safeLatest - safeCommitted);

      partitions[partition] = {
        committedOffset: safeCommitted,
        latestOffset: safeLatest,
        lag,
      };
      totalLag += lag;
    }

    return { topic, groupId, totalLag, partitions };
  } catch (err) {
    console.error('[kafka-consumer] getConsumerLag error', err);
    return {};
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // ignore
    }
  }
}

module.exports = {
  startConsumer,
  stopConsumer,
  getConsumerLag,
};


