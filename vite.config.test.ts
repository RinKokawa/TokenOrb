import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('packaged renderer paths', () => {
  it('uses relative asset paths so Electron file:// builds can load the UI', () => {
    expect(config.base).toBe('./');
  });
});
