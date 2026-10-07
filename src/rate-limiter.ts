/**
 * Per-facility token bucket rate limiter for Metrc API calls.
 *
 * Metrc enforces ~50-60 requests/minute per license. This limiter:
 * - Tracks tokens per facility (each facility = separate license)
 * - Allows bursts (dashboard page load = ~8 concurrent calls)
 * - Queues requests when bucket is empty
 * - Refills at a steady rate
 */

import type { IMetrcClient } from './types.js';

interface BucketState {
  tokens: number;
  lastRefill: number;
  queue: Array<{ resolve: () => void }>;
}

export interface RateLimiterConfig {
  /** Maximum tokens (burst capacity). Default: 50 */
  maxTokens: number;
  /** Tokens added per second. Default: 1 (= 60/minute) */
  refillRate: number;
  /** Max time to wait for a token before rejecting (ms). Default: 30000 */
  maxWaitMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 50,
  refillRate: 1,
  maxWaitMs: 30000,
};

export class MetrcRateLimiter {
  private buckets = new Map<string, BucketState>();
  private config: RateLimiterConfig;
  private drainInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Process queues every 100ms
    this.drainInterval = setInterval(() => this.drainQueues(), 100);
    // Allow garbage collection — guard for Edge runtimes where unref() may not exist
    if (typeof this.drainInterval === 'object' && this.drainInterval !== null && 'unref' in this.drainInterval) {
      (this.drainInterval as { unref: () => void }).unref();
    }
  }

  /**
   * Acquire a token for the given facility.
   * Resolves immediately if tokens available, otherwise queues until one is available.
   * Returns a release function (reserved for future concurrency limiting).
   */
  async acquire(facilityId: string): Promise<() => void> {
    const bucket = this.getBucket(facilityId);
    this.refill(bucket);

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return () => { /* release — reserved for future concurrency tracking */ };
    }

    return new Promise<() => void>((resolve, reject) => {
      const entry = {
        resolve: () => resolve(() => { /* release */ }),
      };
      bucket.queue.push(entry);

      setTimeout(() => {
        const idx = bucket.queue.indexOf(entry);
        if (idx !== -1) {
          bucket.queue.splice(idx, 1);
          reject(new Error(`Rate limiter timeout: waited ${this.config.maxWaitMs}ms for facility ${facilityId}`));
        }
      }, this.config.maxWaitMs);
    });
  }

  /** Get current stats for a facility. */
  getStats(facilityId: string): { tokens: number; queued: number } {
    const bucket = this.getBucket(facilityId);
    this.refill(bucket);
    return {
      tokens: Math.floor(bucket.tokens),
      queued: bucket.queue.length,
    };
  }

  /** Clean up the interval timer. */
  destroy(): void {
    if (this.drainInterval) {
      clearInterval(this.drainInterval);
      this.drainInterval = null;
    }
  }

  private getBucket(facilityId: string): BucketState {
    let bucket = this.buckets.get(facilityId);
    if (!bucket) {
      bucket = {
        tokens: this.config.maxTokens,
        lastRefill: Date.now(),
        queue: [],
      };
      this.buckets.set(facilityId, bucket);
    }
    return bucket;
  }

  private refill(bucket: BucketState): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const newTokens = elapsed * this.config.refillRate;
    bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }

  private drainQueues(): void {
    for (const bucket of this.buckets.values()) {
      this.refill(bucket);
      while (bucket.queue.length > 0 && bucket.tokens > 0) {
        bucket.tokens--;
        const entry = bucket.queue.shift();
        entry?.resolve();
      }
    }
  }
}

/**
 * Wrap an IMetrcClient with per-facility rate limiting via Proxy.
 * Every method call acquires a rate limiter token before executing.
 */
export function withRateLimitClient(
  client: IMetrcClient,
  limiter: MetrcRateLimiter,
  facilityId: string,
): IMetrcClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        const release = await limiter.acquire(facilityId);
        try {
          return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        } finally {
          release();
        }
      };
    },
  });
}
