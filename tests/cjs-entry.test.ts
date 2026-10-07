import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cjsPath = fileURLToPath(new URL('../dist/cjs/index.js', import.meta.url));

describe('CommonJS entry', () => {
  it('loads via require() and exposes the public API', () => {
    if (!existsSync(cjsPath)) throw new Error('dist/cjs missing: run npm run build first');
    const require = createRequire(import.meta.url);
    const m = require('../dist/cjs/index.js');
    expect(typeof m.createMetrcClient).toBe('function');
    expect(typeof m.encodeBasicAuth).toBe('function');
  });
});
