import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePackagedEnvPath } from './env';

describe('resolvePackagedEnvPath', () => {
  it('uses the portable executable directory when available', () => {
    expect(resolvePackagedEnvPath('C:\\temp\\resources', 'D:\\apps\\TokenOrb')).toBe(
      path.join('D:\\apps\\TokenOrb', '.env'),
    );
  });

  it('falls back to the packaged resources directory', () => {
    expect(resolvePackagedEnvPath('C:\\TokenOrb\\resources', undefined)).toBe(
      path.join('C:\\TokenOrb\\resources', '.env'),
    );
  });

  it('ignores an empty portable executable directory', () => {
    expect(resolvePackagedEnvPath('C:\\TokenOrb\\resources', '  ')).toBe(
      path.join('C:\\TokenOrb\\resources', '.env'),
    );
  });
});
