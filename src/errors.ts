/**
 * Typed error classes for Metrc API responses.
 * Allows callers to programmatically distinguish rate-limit vs auth vs validation errors.
 */

export class MetrcApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;
  public readonly retryAfterSeconds: number | undefined;

  constructor(statusCode: number, responseBody: string, retryAfterSeconds?: number) {
    super(`METRC API Error (${statusCode}): ${responseBody}`);
    this.name = 'MetrcApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get isRetryable(): boolean {
    return [429, 500, 502, 503, 504].includes(this.statusCode);
  }
}

export class MetrcRateLimitError extends MetrcApiError {
  constructor(responseBody: string, retryAfterSeconds?: number) {
    super(429, responseBody, retryAfterSeconds);
    this.name = 'MetrcRateLimitError';
  }
}

export class MetrcAuthError extends MetrcApiError {
  constructor(responseBody: string) {
    super(401, responseBody);
    this.name = 'MetrcAuthError';
  }
}

export class MetrcForbiddenError extends MetrcApiError {
  constructor(responseBody: string) {
    super(403, responseBody);
    this.name = 'MetrcForbiddenError';
  }
}

export class MetrcValidationError extends MetrcApiError {
  constructor(responseBody: string) {
    super(422, responseBody);
    this.name = 'MetrcValidationError';
  }
}

export class MetrcNotFoundError extends MetrcApiError {
  constructor(responseBody: string) {
    super(404, responseBody);
    this.name = 'MetrcNotFoundError';
  }
}

/**
 * Create the appropriate typed error based on HTTP status code.
 */
export function createMetrcError(statusCode: number, responseBody: string, retryAfterSeconds?: number): MetrcApiError {
  switch (statusCode) {
    case 401:
      return new MetrcAuthError(responseBody);
    case 403:
      return new MetrcForbiddenError(responseBody);
    case 404:
      return new MetrcNotFoundError(responseBody);
    case 422:
      return new MetrcValidationError(responseBody);
    case 429:
      return new MetrcRateLimitError(responseBody, retryAfterSeconds);
    default:
      return new MetrcApiError(statusCode, responseBody, retryAfterSeconds);
  }
}
