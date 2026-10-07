import { describe, it, expect } from 'vitest';
import { getMetrcApiUrl, isSupportedState, getSupportedStates } from '../src/state-urls.js';

describe('getMetrcApiUrl', () => {
  it('returns sandbox URL for CO', () => {
    expect(getMetrcApiUrl('CO', 'sandbox')).toBe('https://sandbox-api-co.metrc.com');
  });

  it('returns production URL for CA', () => {
    expect(getMetrcApiUrl('CA', 'production')).toBe('https://api-ca.metrc.com');
  });

  it('is case-insensitive', () => {
    expect(getMetrcApiUrl('co', 'sandbox')).toBe('https://sandbox-api-co.metrc.com');
    expect(getMetrcApiUrl('Ca', 'production')).toBe('https://api-ca.metrc.com');
  });

  it('throws for unsupported state', () => {
    expect(() => getMetrcApiUrl('XX', 'sandbox')).toThrow('Unsupported METRC state: XX');
  });

  it('supports all 23 known states', () => {
    const states = getSupportedStates();
    expect(states.length).toBe(23);
    for (const state of states) {
      expect(() => getMetrcApiUrl(state, 'production')).not.toThrow();
      expect(() => getMetrcApiUrl(state, 'sandbox')).not.toThrow();
    }
  });
});

describe('isSupportedState', () => {
  it('returns true for valid states', () => {
    expect(isSupportedState('CO')).toBe(true);
    expect(isSupportedState('CA')).toBe(true);
    expect(isSupportedState('OR')).toBe(true);
  });

  it('returns false for invalid states', () => {
    expect(isSupportedState('XX')).toBe(false);
    expect(isSupportedState('ZZ')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedState('co')).toBe(true);
  });
});
