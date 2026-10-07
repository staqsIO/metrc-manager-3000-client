/**
 * Retry wrapper with exponential backoff for Metrc API calls.
 *
 * - Retries on 429 (rate limit) and 5xx (server errors)
 * - Respects Retry-After header on 429
 * - Adds jitter to prevent thundering herd
 * - Does NOT retry on 4xx client errors (except 429)
 */

import { MetrcApiError } from './errors.js';
import type { IMetrcClient } from './types.js';

export interface RetryConfig {
  /** Maximum total attempts (1 = no retry). Default: 3 */
  maxAttempts: number;
  /** Initial delay in ms before first retry. Default: 1000 */
  initialDelayMs: number;
  /** Maximum delay in ms. Default: 30000 */
  maxDelayMs: number;
  /** Multiplier for each successive delay. Default: 2 */
  backoffMultiplier: number;
  /** Jitter factor (0 to 1). Adds random 0-N% to delay. Default: 0.25 */
  jitterFactor: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.25,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addJitter(delayMs: number, factor: number): number {
  const jitter = delayMs * factor * Math.random();
  return Math.floor(delayMs + jitter);
}

/**
 * Execute a function with retry logic.
 * Only retries on MetrcApiError with isRetryable=true (429, 5xx).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;
  let delayMs = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!(error instanceof MetrcApiError) || !error.isRetryable) {
        throw error;
      }

      if (attempt >= cfg.maxAttempts) {
        throw error;
      }

      let waitMs = delayMs;
      if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
        waitMs = error.retryAfterSeconds * 1000;
      }

      waitMs = Math.min(waitMs, cfg.maxDelayMs);
      waitMs = addJitter(waitMs, cfg.jitterFactor);

      console.warn(
        `[METRC-RETRY] Attempt ${attempt}/${cfg.maxAttempts} failed (${error.statusCode}). ` +
        `Retrying in ${waitMs}ms...`,
      );

      await sleep(waitMs);
      delayMs = Math.min(delayMs * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError ?? new Error('withRetry exhausted all attempts');
}

/**
 * Wrap an IMetrcClient with retry logic via Proxy.
 * Every method call on the returned client will be retried on retryable errors.
 */
export function withRetryClient(
  client: IMetrcClient,
  config?: Partial<RetryConfig>,
): IMetrcClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        return withRetry(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args), config);
      };
    },
  });
}
