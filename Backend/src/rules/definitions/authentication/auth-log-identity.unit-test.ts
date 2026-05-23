import * as assert from 'node:assert/strict';
import { Log } from '../../../logs/log.schema';
import {
  countIdentitiesFromDocuments,
  extractLoginIdentity,
} from './auth-log-identity';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function makeLog(partial: Partial<Log> & { raw?: Record<string, unknown> }): Log {
  return {
    timestamp: new Date(),
    ip: '1.2.3.4',
    event: 'login_failed',
    ...partial,
  } as Log;
}

run('extractLoginIdentity reads email from raw.rawEvent.context', () => {
  const log = makeLog({
    raw: {
      rawEvent: {
        context: {
          email: 'User@Example.com',
          clientIp: '1.2.3.4',
        },
      },
    },
  });
  assert.equal(extractLoginIdentity(log), 'user@example.com');
});

run('extractLoginIdentity reads username from context.body', () => {
  const log = makeLog({
    raw: {
      rawEvent: {
        context: {
          body: { username: 'alice', password: 'x' },
        },
      },
    },
  });
  assert.equal(extractLoginIdentity(log), 'alice');
});

run('extractLoginIdentity prefers top-level user', () => {
  const log = makeLog({ user: 'bob@corp.test' });
  assert.equal(extractLoginIdentity(log), 'bob@corp.test');
});

run('countIdentitiesFromDocuments dedupes user and body email', () => {
  const docs = [
    makeLog({ user: 'user1@test.com' }),
    makeLog({
      raw: { rawEvent: { context: { body: { email: 'user2@test.com' } } } },
    }),
    makeLog({
      raw: { rawEvent: { context: { body: { username: 'user3' } } } },
    }),
    makeLog({ user: 'user1@test.com' }),
  ];
  const stats = countIdentitiesFromDocuments(docs);
  assert.equal(stats.uniqueIdentities, 3);
  assert.equal(stats.totalAttempts, 4);
});

run('countIdentitiesFromDocuments reaches stuffing threshold with 10 accounts', () => {
  const docs = Array.from({ length: 12 }, (_, i) =>
    makeLog({
      raw: {
        rawEvent: {
          context: { body: { email: `victim${i}@test.com` } },
        },
      },
    }),
  );
  const stats = countIdentitiesFromDocuments(docs);
  assert.ok(stats.uniqueIdentities >= 10);
});
