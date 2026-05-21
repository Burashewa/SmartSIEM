import * as assert from 'node:assert/strict';
import { Log } from '../../../logs/log.schema';
import {
  extractPathTraversalTargets,
  matchPathTraversalInValue,
  scanLogForPathTraversal,
} from './path-traversal-lfi.scan';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function makeLog(raw: Record<string, unknown>): Log {
  return { raw } as Log;
}

run('extracts pageUrl and body fields from raw.rawEvent.context', () => {
  const log = makeLog({
    rawEvent: {
      context: {
        pageUrl: 'https://app.example.com/view?file=doc.pdf',
        pagePath: '/view',
        apiRequestUrl: '/api/files/read',
        body: { path: '../../etc/passwd', note: 'benign' },
      },
    },
  });
  const fields = extractPathTraversalTargets(log);
  assert.ok(fields.some((f) => f.source === 'raw.rawEvent.context.pageUrl'));
  assert.ok(fields.some((f) => f.source === 'raw.rawEvent.context.body' && f.value.includes('passwd')));
});

run('detects classic ../ traversal in pagePath', () => {
  const hits = matchPathTraversalInValue('../../etc/passwd', 'raw.rawEvent.context.pagePath');
  assert.ok(hits.some((h) => h.id === 'dot_dot_slash'));
  assert.ok(hits.some((h) => h.id === 'unix_sensitive_file'));
});

run('detects URL-encoded traversal in apiRequestUrl', () => {
  const hits = matchPathTraversalInValue(
    '/download?f=%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    'raw.rawEvent.context.apiRequestUrl',
  );
  assert.ok(hits.length > 0);
});

run('detects php://filter wrapper in body', () => {
  const hits = matchPathTraversalInValue(
    'php://filter/convert.base64-encode/resource=index.php',
    'raw.rawEvent.context.body',
  );
  assert.ok(hits.some((h) => h.id === 'php_stream_wrapper'));
});

run('scanLogForPathTraversal returns hits with field provenance', () => {
  const log = makeLog({
    rawEvent: {
      context: {
        url: '/static/../../../windows/win.ini',
      },
    },
  });
  const { hits } = scanLogForPathTraversal(log);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].source, 'raw.rawEvent.context.url');
});
