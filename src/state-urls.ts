import type { MetrcEnvironment } from './types.js';

/**
 * All known METRC state codes, compiled from METRC's published state
 * integrator documentation.
 */
const SUPPORTED_STATES = [
  'AK', 'AZ', 'CA', 'CO', 'DC', 'LA', 'MA', 'MD', 'ME', 'MI',
  'MO', 'MS', 'MT', 'NJ', 'NV', 'OH', 'OK', 'OR', 'RI', 'SD',
  'UT', 'VT', 'WV',
] as const;

export type MetrcStateCode = (typeof SUPPORTED_STATES)[number];

/**
 * Returns the METRC API base URL for a given state and environment.
 *
 * @example
 * getMetrcApiUrl('CO', 'sandbox')  // 'https://sandbox-api-co.metrc.com'
 * getMetrcApiUrl('CA', 'production') // 'https://api-ca.metrc.com'
 */
export function getMetrcApiUrl(stateCode: string, environment: MetrcEnvironment): string {
  const upper = stateCode?.toUpperCase();
  if (!(SUPPORTED_STATES as readonly string[]).includes(upper)) {
    throw new Error(
      `Unsupported METRC state: ${stateCode}. Supported: ${SUPPORTED_STATES.join(', ')}`,
    );
  }

  const code = upper.toLowerCase();
  switch (environment) {
    case 'sandbox':
      return `https://sandbox-api-${code}.metrc.com`;
    case 'production':
      return `https://api-${code}.metrc.com`;
  }
}

/** Check if a state code is supported by METRC. */
export function isSupportedState(stateCode: string): stateCode is MetrcStateCode {
  return (SUPPORTED_STATES as readonly string[]).includes(stateCode?.toUpperCase());
}

/** Get all supported state codes. */
export function getSupportedStates(): readonly string[] {
  return SUPPORTED_STATES;
}
