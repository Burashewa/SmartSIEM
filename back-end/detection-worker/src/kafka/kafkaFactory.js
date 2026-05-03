const fs = require('fs');
const path = require('path');
const { Kafka } = require('kafkajs');

/**
 * TLS options matching SmartSIEM-Collector `outputs/kafka_writer.py`
 * (ca.pem, service.cert, service.key in KAFKA_CERT_FOLDER).
 * @returns {import('kafkajs').Broker['ssl'] | undefined}
 */
function loadSslFromCertFolder() {
  const proto = (process.env.KAFKA_SECURITY_PROTOCOL || '').trim().toUpperCase();
  if (proto === 'PLAINTEXT') return undefined;

  const folder = (process.env.KAFKA_CERT_FOLDER || '').trim();
  if (!folder) return undefined;

  const resolved = path.resolve(folder);
  const caPath = path.join(resolved, 'ca.pem');
  const certPath = path.join(resolved, 'service.cert');
  const keyPath = path.join(resolved, 'service.key');

  const missing = [caPath, certPath, keyPath].filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    console.warn(
      `[kafka] KAFKA_CERT_FOLDER=${resolved} but missing files: ${missing.map((p) => path.basename(p)).join(', ')} — connecting without client TLS (will fail if broker requires mTLS)`
    );
    return undefined;
  }

  const rejectUnauthorized = process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false';

  return {
    rejectUnauthorized,
    ca: [fs.readFileSync(caPath, 'utf8')],
    cert: fs.readFileSync(certPath, 'utf8'),
    key: fs.readFileSync(keyPath, 'utf8'),
  };
}

/**
 * @param {{ brokers: string[]; clientId: string }} opts
 */
function createKafka(opts) {
  const ssl = loadSslFromCertFolder();
  return new Kafka({
    clientId: opts.clientId,
    brokers: opts.brokers,
    ...(ssl ? { ssl } : {}),
  });
}

module.exports = {
  createKafka,
  loadSslFromCertFolder,
};
