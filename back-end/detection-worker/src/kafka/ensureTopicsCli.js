require('../config');
const { ensureKafkaTopics } = require('./ensureTopics');

ensureKafkaTopics()
  .then(() => {
    console.log('[kafka:topics] done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[kafka:topics] failed', err);
    process.exit(1);
  });
