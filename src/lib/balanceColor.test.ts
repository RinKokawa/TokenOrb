import { describe, expect, it } from 'vitest';
import {
  classifyBalance,
  getBalanceRingBgClass,
  getBalanceStroke,
  getBalanceTextClass,
} from './balanceColor';

describe('balance color helpers', () => {
  it.each([
    [100, 'full'],
    [50, 'full'],
    [49.9, 'mid'],
    [10, 'mid'],
    [9.9, 'low'],
    [0, 'low'],
  ] as const)('classifies %s as %s', (percentage, expected) => {
    expect(classifyBalance(percentage)).toBe(expected);
  });

  it('returns matching visual tokens for every balance level', () => {
    expect({
      stroke: getBalanceStroke(75),
      text: getBalanceTextClass(75),
      background: getBalanceRingBgClass(75),
    }).toEqual({
      stroke: 'var(--balance-full)',
      text: 'balance-text-full',
      background: 'balance-surface-full',
    });

    expect({
      stroke: getBalanceStroke(25),
      text: getBalanceTextClass(25),
      background: getBalanceRingBgClass(25),
    }).toEqual({
      stroke: 'var(--balance-mid)',
      text: 'balance-text-mid',
      background: 'balance-surface-mid',
    });

    expect({
      stroke: getBalanceStroke(5),
      text: getBalanceTextClass(5),
      background: getBalanceRingBgClass(5),
    }).toEqual({
      stroke: 'var(--balance-low)',
      text: 'balance-text-low',
      background: 'balance-surface-low',
    });
  });
});
