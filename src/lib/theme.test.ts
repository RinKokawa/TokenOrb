import { describe, expect, it } from 'vitest';
import { accentOptions, normalizeAccent, type Accent } from './theme';

describe('appearance accents', () => {
  it('offers distinct classic, gold, pink, and ocean presets', () => {
    expect(accentOptions).toEqual(['classic', 'gold', 'pink', 'ocean']);
  });

  it.each([
    ['classic', 'classic'],
    ['gold', 'gold'],
    ['pink', 'pink'],
    ['ocean', 'ocean'],
  ] as const)('accepts the stored %s preset', (value, expected) => {
    expect(normalizeAccent(value)).toBe(expected satisfies Accent);
  });

  it.each([null, '', 'purple', 'GOLD', 'unknown'])('falls back for invalid preset %s', (value) => {
    expect(normalizeAccent(value)).toBe('classic');
  });
});
