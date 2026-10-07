// ── Client ──
export { MetrcClient, createMetrcClient } from './client.js';

// ── Types ──
export type {
  MetrcClientConfig,
  MetrcEnvironment,
  MetrcAuthMethod,
  MetrcPaginationParams,
  IMetrcClient,
  MetrcPackage,
  MetrcPlant,
  MetrcTransfer,
  MetrcDelivery,
  MetrcDeliveryPackage,
  MetrcDeliveryPackageWholesale,
  MetrcSaleReceipt,
  MetrcSaleReceiptDetail,
  MetrcSaleReceiptTransaction,
  MetrcLabTest,
  MetrcStrain,
  MetrcItem,
  MetrcLocation,
  MetrcHarvest,
  MetrcHarvestWaste,
  MetrcPlantBatch,
  MetrcPlantBatchWaste,
  MetrcWasteReason,
  MetrcPackageAdjustReason,
  MetrcWasteMethod,
  MetrcTag,
} from './types.js';

// ── Errors ──
export {
  MetrcApiError,
  MetrcRateLimitError,
  MetrcAuthError,
  MetrcForbiddenError,
  MetrcValidationError,
  MetrcNotFoundError,
  createMetrcError,
} from './errors.js';

// ── State URLs ──
export { getMetrcApiUrl, isSupportedState, getSupportedStates } from './state-urls.js';
export type { MetrcStateCode } from './state-urls.js';

// ── Auth ──
export { generateHmacSignature, buildHmacHeaders, encodeBasicAuth } from './auth.js';
export type { HmacSignatureResult } from './auth.js';

// ── Retry ──
export { withRetry, withRetryClient } from './retry.js';
export type { RetryConfig } from './retry.js';

// ── Rate Limiter ──
export { MetrcRateLimiter, withRateLimitClient } from './rate-limiter.js';
export type { RateLimiterConfig } from './rate-limiter.js';
