/**
 * Sends synthetic log events to Kafka (raw.logs) to exercise detection rules.
 * Run from this directory after Kafka is up:
 *   node test-send-logs.js
 */

const { Kafka } = require('kafkajs');
const config = require('./src/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isoNow() {
  return new Date().toISOString();
}

async function sendEvent(producer, event) {
  const payload = {
    ...event,
    timestamp: event.timestamp ?? isoNow(),
  };
  await producer.send({
    topic: config.kafka.rawLogsTopic,
    messages: [{ value: JSON.stringify(payload) }],
  });
  console.log('[test-send]', payload.event_type, payload.source_ip, payload.user_id || '', payload.raw_data?.path || payload.raw_data?.query || '');
}

async function main() {
  const kafka = new Kafka({
    clientId: `${config.kafka.clientId}-test-send-logs`,
    brokers: config.kafka.brokers,
  });
  const producer = kafka.producer();

  console.log('[test-send] connecting to', config.kafka.brokers.join(','), 'topic', config.kafka.rawLogsTopic);
  await producer.connect();
  console.log('[test-send] connected');

  const delayBetweenEventsMs = 350;

  // --- 1) Brute force: 10 AUTH_FAIL from same IP/user within ~30s window ---
  console.log('\n[test-send] scenario: brute force (10 AUTH_FAIL)');
  for (let i = 0; i < 10; i += 1) {
    await sendEvent(producer, {
      event_type: 'AUTH_FAIL',
      source_ip: '10.0.0.99',
      user_id: 'admin',
      username: 'admin',
      raw_data: { reason: 'invalid_password', attempt: i + 1 },
    });
    await sleep(delayBetweenEventsMs);
  }
  await sleep(2000);

  // --- 2) Brute force + successful login (sequence seq-001 + threshold noise) ---
  console.log('\n[test-send] scenario: AUTH_FAIL burst then AUTH_SUCCESS (same user/IP)');
  for (let i = 0; i < 10; i += 1) {
    await sendEvent(producer, {
      event_type: 'AUTH_FAIL',
      source_ip: '10.0.0.98',
      user_id: 'admin',
      username: 'admin',
      raw_data: { reason: 'invalid_password', attempt: i + 1 },
    });
    await sleep(delayBetweenEventsMs);
  }
  await sleep(1500);
  await sendEvent(producer, {
    event_type: 'AUTH_SUCCESS',
    source_ip: '10.0.0.98',
    user_id: 'admin',
    username: 'admin',
    raw_data: { method: 'password' },
  });
  await sleep(2000);

  // --- 3) PowerShell encoded command ---
  console.log('\n[test-send] scenario: PROC_CREATE with -EncodedCommand');
  await sendEvent(producer, {
    event_type: 'PROC_CREATE',
    source_ip: '10.0.0.50',
    user_id: 'jdoe',
    process_name: 'powershell.exe',
    raw_data: {
      command_line:
        'powershell.exe -NoProfile -EncodedCommand SGVsbG9Xb3JsZDEyMzQ1Njc4OTA=',
    },
  });
  await sleep(1500);

  // --- 4) LSASS access ---
  console.log('\n[test-send] scenario: PROC_ACCESS lsass.exe');
  await sendEvent(producer, {
    event_type: 'PROC_ACCESS',
    source_ip: '10.0.0.51',
    user_id: 'SYSTEM',
    raw_data: {
      target_process: 'lsass.exe',
      granted_access: 'PROCESS_VM_READ',
    },
  });
  await sleep(1500);

  // --- 5) DNS high-entropy queries (several) ---
  console.log('\n[test-send] scenario: DNS_QUERY high-entropy domains');
  const highEntropyDomains = [
    'xK9mPq2vL8nR4tY7wZ3bC6fH1jM5sA0uD9eG2hJ4kN8pQwRtYzVx.cfd',
    'Zq4Wn8Rt2Yp6Ls1Hv9Mx3Bc7Df0Jg5Nk8Pm2Qs6Tu0Vy4Xz8Ab.cfd',
    'mN7bV3cX9zL5kJ1hG6fD2sA8pO4iU0yT6rE3wQ9nM5bV1xZ7cK3jH9fD5.io',
  ];
  for (const query of highEntropyDomains) {
    await sendEvent(producer, {
      event_type: 'DNS_QUERY',
      source_ip: '10.0.0.52',
      user_id: 'workstation-01',
      raw_data: { query },
    });
    await sleep(400);
  }
  await sleep(1500);

  // --- 6) Ransomware-like burst: 150 FILE_MODIFY same user (.enc paths) ---
  console.log('\n[test-send] scenario: 150 FILE_MODIFY (.enc) same user');
  const ransomUser = 'corp\\victim_user';
  for (let i = 0; i < 150; i += 1) {
    await sendEvent(producer, {
      event_type: 'FILE_MODIFY',
      source_ip: '10.0.0.53',
      user_id: ransomUser,
      username: ransomUser,
      raw_data: {
        path: `C:\\Users\\Public\\Documents\\file_${i}.dat.enc`,
        operation: 'write',
      },
    });
    if (i % 20 === 0 && i > 0) await sleep(50);
    else await sleep(30);
  }

  console.log('\n[test-send] all scenarios sent; waiting 5s before disconnect...');
  await sleep(5000);

  await producer.disconnect();
  console.log('[test-send] disconnected. Done.');
}

main().catch((err) => {
  console.error('[test-send] fatal error', err);
  process.exit(1);
});
