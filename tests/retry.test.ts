import { describe, it, expect, vi } from 'vitest';
import { withRetry, withRetryClient } from '../src/retry.js';
import { MetrcApiError, MetrcAuthError } from '../src/errors.js';
import type { IMetrcClient } from '../src/types.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new MetrcApiError(500, 'server error'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1, jitterFactor: 0 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new MetrcAuthError('bad creds'));

    await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow('bad creds');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-MetrcApiError errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow('network down');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts then throws', async () => {
    const fn = vi.fn().mockRejectedValue(new MetrcApiError(503, 'unavailable'));

    await expect(
      withRetry(fn, { maxAttempts: 2, initialDelayMs: 1, jitterFactor: 0 }),
    ).rejects.toThrow('unavailable');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects Retry-After header on 429', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new MetrcApiError(429, 'rate limited', 1))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, { maxAttempts: 2, initialDelayMs: 10000, maxDelayMs: 10000, jitterFactor: 0 });
    const elapsed = Date.now() - start;
    // Retry-After is 1s, which overrides initialDelayMs of 10s
    expect(elapsed).toBeLessThan(3000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withRetryClient', () => {
  it('wraps client methods with retry', async () => {
    let callCount = 0;
    const mockClient = {
      getActiveStrains: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new MetrcApiError(500, 'fail');
        return [{ Id: 1, Name: 'OG Kush' }];
      }),
    } as unknown as IMetrcClient;

    const retrying = withRetryClient(mockClient, { maxAttempts: 3, initialDelayMs: 1, jitterFactor: 0 });
    const result = await retrying.getActiveStrains();

    expect(result).toEqual([{ Id: 1, Name: 'OG Kush' }]);
    expect(callCount).toBe(2);
  });
});
