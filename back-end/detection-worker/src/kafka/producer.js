const { Partitioners } = require('kafkajs');
const config = require('../config');
const { createKafka } = require('./kafkaFactory');

const kafka = createKafka({
  clientId: `${config.kafka.clientId}-producer`,
  brokers: config.kafka.brokers,
});

const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
let isConnected = false;

async function connectProducer() {
  try {
    if (isConnected) return true;
    await producer.connect();
    isConnected = true;
    console.log('[kafka-producer] connected');
    return true;
  } catch (err) {
    console.error('[kafka-producer] connectProducer error', err);
    return false;
  }
}

async function disconnectProducer() {
  try {
    if (!isConnected) return;
    await producer.disconnect();
    isConnected = false;
    console.log('[kafka-producer] disconnected');
  } catch (err) {
    console.error('[kafka-producer] disconnectProducer error', err);
  }
}

async function sendAlert(alertObject) {
  try {
    if (!isConnected) await connectProducer();

    const key = alertObject?.alert_id ? String(alertObject.alert_id) : undefined;
    const value = JSON.stringify(alertObject ?? {});

    return await producer.send({
      topic: config.kafka.alertsTopic,
      messages: [{ key, value }],
    });
  } catch (err) {
    console.error('[kafka-producer] sendAlert error', err);
    return undefined;
  }
}

module.exports = {
  connectProducer,
  disconnectProducer,
  sendAlert,
};


