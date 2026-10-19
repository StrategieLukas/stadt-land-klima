import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNoCredentialFields, assertNoDisclosure } from './lib/disclosure.js';

test('secret detection covers raw, escaped and encoded values without logging them', () => {
  const value = 'Synthetic-private-key-18/abc';
  const marker = [{ label: 'private service key', value }];
  for (const body of [
    `<script>${value}</script>`, JSON.stringify({ nested: [value] }), encodeURIComponent(value),
    Buffer.from(value).toString('base64'), value.replace(/./g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`),
  ]) {
    assert.throws(() => assertNoDisclosure(body, marker, 'test response'), error => {
      assert(error instanceof Error);
      assert.match(error.message, /private service key/);
      assert(!error.message.includes(value));
      return true;
    });
  }
});

test('nested arrays and relation fields cannot conceal credential properties', () => {
  assert.throws(() => assertNoCredentialFields({ candidates: [{ name: 'Safe', relation: { access_token: null } }] }, 'response'), /forbidden response field/);
  assert.doesNotThrow(() => assertNoCredentialFields({ candidates: [{ name: 'Safe', party: 'Example' }] }, 'response'));
});

test('empty or weak canaries cannot silently pass a disclosure assertion', () => {
  assert.throws(() => assertNoDisclosure('{}', [{ label: 'missing setup', value: '' }], 'response'), /must be distinctive/);
  assert.doesNotThrow(() => assertNoDisclosure('{"name":"Public name"}', [{ label: 'private', value: 'Distinct-private-canary' }], 'response'));
});
