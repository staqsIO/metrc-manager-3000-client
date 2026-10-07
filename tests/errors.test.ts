import { describe, it, expect } from 'vitest';
import {
  MetrcApiError,
  MetrcRateLimitError,
  MetrcAuthError,
  MetrcForbiddenError,
  MetrcValidationError,
  MetrcNotFoundError,
  createMetrcError,
} from '../src/errors.js';

describe('MetrcApiError', () => {
  it('includes status code and body in message', () => {
    const err = new MetrcApiError(500, 'Internal Server Error');
    expect(err.message).toBe('METRC API Error (500): Internal Server Error');
    expect(err.statusCode).toBe(500);
    expect(err.responseBody).toBe('Internal Server Error');
    expect(err.name).toBe('MetrcApiError');
  });

  it('isRetryable for 429 and 5xx', () => {
    expect(new MetrcApiError(429, '').isRetryable).toBe(true);
    expect(new MetrcApiError(500, '').isRetryable).toBe(true);
    expect(new MetrcApiError(502, '').isRetryable).toBe(true);
    expect(new MetrcApiError(503, '').isRetryable).toBe(true);
    expect(new MetrcApiError(504, '').isRetryable).toBe(true);
  });

  it('is not retryable for 4xx (except 429)', () => {
    expect(new MetrcApiError(400, '').isRetryable).toBe(false);
    expect(new MetrcApiError(401, '').isRetryable).toBe(false);
    expect(new MetrcApiError(403, '').isRetryable).toBe(false);
    expect(new MetrcApiError(404, '').isRetryable).toBe(false);
    expect(new MetrcApiError(422, '').isRetryable).toBe(false);
  });

  it('stores retryAfterSeconds', () => {
    const err = new MetrcApiError(429, 'too fast', 30);
    expect(err.retryAfterSeconds).toBe(30);
  });
});

describe('Typed error subclasses', () => {
  it('MetrcRateLimitError is 429', () => {
    const err = new MetrcRateLimitError('slow down', 10);
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('MetrcRateLimitError');
    expect(err.retryAfterSeconds).toBe(10);
    expect(err).toBeInstanceOf(MetrcApiError);
  });

  it('MetrcAuthError is 401', () => {
    const err = new MetrcAuthError('bad creds');
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('MetrcAuthError');
    expect(err).toBeInstanceOf(MetrcApiError);
  });

  it('MetrcForbiddenError is 403', () => {
    const err = new MetrcForbiddenError('no access');
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe('MetrcForbiddenError');
  });

  it('MetrcValidationError is 422', () => {
    const err = new MetrcValidationError('bad data');
    expect(err.statusCode).toBe(422);
    expect(err.name).toBe('MetrcValidationError');
  });

  it('MetrcNotFoundError is 404', () => {
    const err = new MetrcNotFoundError('not here');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('MetrcNotFoundError');
  });
});

describe('createMetrcError', () => {
  it('returns MetrcAuthError for 401', () => {
    const err = createMetrcError(401, 'unauthorized');
    expect(err).toBeInstanceOf(MetrcAuthError);
  });

  it('returns MetrcForbiddenError for 403', () => {
    const err = createMetrcError(403, 'forbidden');
    expect(err).toBeInstanceOf(MetrcForbiddenError);
  });

  it('returns MetrcNotFoundError for 404', () => {
    const err = createMetrcError(404, 'not found');
    expect(err).toBeInstanceOf(MetrcNotFoundError);
  });

  it('returns MetrcValidationError for 422', () => {
    const err = createMetrcError(422, 'invalid');
    expect(err).toBeInstanceOf(MetrcValidationError);
  });

  it('returns MetrcRateLimitError for 429', () => {
    const err = createMetrcError(429, 'rate limited', 60);
    expect(err).toBeInstanceOf(MetrcRateLimitError);
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('returns base MetrcApiError for unknown codes', () => {
    const err = createMetrcError(500, 'server error');
    expect(err).toBeInstanceOf(MetrcApiError);
    expect(err.statusCode).toBe(500);
  });
});
