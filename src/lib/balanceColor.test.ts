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
      stroke: '#34d399',
      text: 'text-emerald-300',
      background: 'bg-emerald-500/15',
    });

    expect({
      stroke: getBalanceStroke(25),
      text: getBalanceTextClass(25),
      background: getBalanceRingBgClass(25),
    }).toEqual({
      stroke: '#818cf8',
      text: 'text-indigo-300',
      background: 'bg-indigo-500/15',
    });

    expect({
      stroke: getBalanceStroke(5),
      text: getBalanceTextClass(5),
      background: getBalanceRingBgClass(5),
    }).toEqual({
      stroke: '#f87171',
      text: 'text-rose-300',
      background: 'bg-rose-500/15',
    });
  });
});
