import * as assert from 'node:assert/strict';
import { matchSqliPatterns } from './sqli-body.scan';
import { matchXssPatterns } from './xss-body.scan';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function sqliHits(payload: string): string[] {
  return matchSqliPatterns(payload).map((h) => h.id);
}

function xssHits(payload: string): string[] {
  return matchXssPatterns(payload).map((h) => h.id);
}

run('SQLi detects classic OR 1=1', () => {
  assert.ok(sqliHits("' OR 1=1--").includes('or_true'));
});

run('SQLi detects URL-encoded UNION SELECT', () => {
  assert.ok(sqliHits('%55%4e%49%4f%4e%20%53%45%4c%45%43%54%201,2').includes('union_select'));
});

run('SQLi detects comment-obfuscated union', () => {
  const hits = sqliHits('1 UN/**/ION SEL/**/ECT NULL--');
  assert.ok(hits.includes('union_select') || hits.includes('obfuscated_union'));
});

run('SQLi detects time-based sleep()', () => {
  assert.ok(sqliHits("1' AND sleep(5)--").includes('time_based'));
});

run('SQLi detects hex CHAR obfuscation', () => {
  assert.ok(sqliHits("SELECT CHAR(0x27,0x4f,0x52)").includes('char_obfuscation'));
});

run('SQLi detects information_schema', () => {
  assert.ok(sqliHits("' UNION SELECT table_name FROM information_schema.tables--").length > 0);
});

run('XSS detects script tag', () => {
  assert.ok(xssHits('<script>alert(1)</script>').includes('script_tag'));
});

run('XSS detects HTML-encoded script', () => {
  const hits = xssHits('&#60;script&#62;alert(1)&#60;/script&#62;');
  assert.ok(hits.includes('encoded_script') || hits.includes('script_tag'));
});

run('XSS detects img onerror', () => {
  assert.ok(xssHits('<img src=x onerror=alert(1)>').includes('img_onerror'));
});

run('XSS detects javascript: URI', () => {
  assert.ok(xssHits('<a href="javascript:alert(1)">').includes('javascript_uri'));
});

run('XSS detects String.fromCharCode', () => {
  assert.ok(xssHits('eval(String.fromCharCode(88,83,83))').includes('fromcharcode'));
});

run('XSS detects obfuscated event handler', () => {
  assert.ok(xssHits('<svg/onload=alert(1)>').includes('svg_tag_handler'));
});
