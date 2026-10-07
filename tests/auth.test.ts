import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { generateHmacSignature, encodeBasicAuth, buildHmacHeaders } from '../src/auth.js';

describe('generateHmacSignature', () => {
  it('produces a valid HMAC-SHA256 hex signature', async () => {
    const key = 'test-user-api-key';
    const method = 'GET';
    const path = '/plants/v1/active';
    const body = '';

    const result = await generateHmacSignature(key, method, path, body);

    expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(result.timestamp).toMatch(/^\d+$/);

    // Verify against Node.js crypto directly
    const message = `${method}\n${path}\n${body}\n${result.timestamp}`;
    const expected = createHmac('sha256', key).update(message).digest('hex');
    expect(result.signature).toBe(expected);
  });

  it('produces different signatures for different methods', async () => {
    const key = 'test-key';
    const path = '/packages/v1/active';

    const get = await generateHmacSignature(key, 'GET', path);
    const post = await generateHmacSignature(key, 'POST', path, '[]');

    expect(get.signature).not.toBe(post.signature);
  });

  it('includes body in signature', async () => {
    const key = 'test-key';
    const method = 'POST';
    const path = '/items/v1/create';

    const result = await generateHmacSignature(key, method, path, '[{"Name":"Test"}]');

    const message = `${method}\n${path}\n[{"Name":"Test"}]\n${result.timestamp}`;
    const expected = createHmac('sha256', key).update(message).digest('hex');
    expect(result.signature).toBe(expected);
  });
});

describe('encodeBasicAuth', () => {
  it('returns a properly formatted Basic auth header', () => {
    const result = encodeBasicAuth('vendor-key', 'user-key');
    expect(result).toBe(`Basic ${btoa('vendor-key:user-key')}`);
  });

  it('handles special characters', () => {
    const result = encodeBasicAuth('key+with=chars', 'user/key');
    const decoded = atob(result.replace('Basic ', ''));
    expect(decoded).toBe('key+with=chars:user/key');
  });
});

describe('buildHmacHeaders', () => {
  it('returns all required HMAC headers', async () => {
    const headers = await buildHmacHeaders('vendor-key', 'user-key', 'GET', '/test');

    expect(headers['X-METRC-Vendor-API-Key']).toBe('vendor-key');
    expect(headers['X-METRC-User-API-Key']).toBe('user-key');
    expect(headers['X-METRC-Signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['X-METRC-Timestamp']).toMatch(/^\d+$/);
  });
});
