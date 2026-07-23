import { describe, expect, it } from 'vitest';
import { normalizeTimestamp } from './minimax';

describe('normalizeTimestamp', () => {
  it('converts Unix seconds to JavaScript milliseconds', () => {
    expect(normalizeTimestamp(1_750_000_000)).toBe(1_750_000_000_000);
  });

  it('preserves millisecond timestamps', () => {
    expect(normalizeTimestamp(1_750_000_000_000)).toBe(1_750_000_000_000);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1750000000', null])(
    'rejects invalid timestamp %s',
    (value) => {
      expect(normalizeTimestamp(value)).toBe(0);
    },
  );
});
