import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('package metadata', () => {
  it('is published under the open-source scope', () => {
    expect(pkg.name).toBe('@metrc-formul8-os/client');
  });
  it('has no private registry config', () => {
    expect(pkg.publishConfig?.registry).toBeUndefined();
  });
  it('declares MIT', () => {
    expect(pkg.license).toBe('MIT');
  });
});
