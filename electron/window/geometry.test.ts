import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampBoundsToWorkArea,
  clampPointToWorkArea,
  computeDragPosition,
  isWithinWorkArea,
} from './geometry';

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns boundary values exactly', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('works with negative bounds', () => {
    expect(clamp(-50, -100, -10)).toBe(-50);
    expect(clamp(-200, -100, -10)).toBe(-100);
    expect(clamp(0, -100, -10)).toBe(-10);
  });
});

describe('computeDragPosition', () => {
  it('translates the window by the cursor delta', () => {
    expect(
      computeDragPosition(
        { x: 100, y: 100, width: 80, height: 80 },
        { x: 200, y: 200 },
        { x: 250, y: 230 },
      ),
    ).toEqual({ x: 150, y: 130 });
  });

  it('returns the original bounds when cursor has not moved', () => {
    expect(
      computeDragPosition(
        { x: -1500, y: 0, width: 96, height: 96 },
        { x: -1400, y: 50 },
        { x: -1400, y: 50 },
      ),
    ).toEqual({ x: -1500, y: 0 });
  });

  it('handles negative-origin multi-monitor coordinates', () => {
    expect(
      computeDragPosition(
        { x: -1500, y: 0, width: 96, height: 96 },
        { x: -1400, y: 50 },
        { x: -1300, y: 70 },
      ),
    ).toEqual({ x: -1400, y: 20 });
  });
});

describe('clampPointToWorkArea', () => {
  const size = { width: 96, height: 96 };

  it('keeps a fully inside top-left point unchanged', () => {
    expect(clampPointToWorkArea({ x: 500, y: 500 }, size, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    })).toEqual({ x: 500, y: 500 });
  });

  it('clamps an overflowing point against the bottom-right edge', () => {
    expect(clampPointToWorkArea({ x: 2000, y: 1200 }, size, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    })).toEqual({ x: 1824, y: 984 });
  });

  it('clamps against a negative-origin workArea', () => {
    expect(clampPointToWorkArea({ x: -2100, y: -1200 }, size, {
      x: -1920,
      y: -1080,
      width: 1920,
      height: 1080,
    })).toEqual({ x: -1920, y: -1080 });
  });

  it('keeps a negative point within a negative-origin workArea', () => {
    expect(clampPointToWorkArea({ x: -1500, y: -500 }, size, {
      x: -1920,
      y: -1080,
      width: 1920,
      height: 1080,
    })).toEqual({ x: -1500, y: -500 });
  });
});

describe('clampBoundsToWorkArea', () => {
  it('keeps a fully-inside rectangle unchanged', () => {
    expect(
      clampBoundsToWorkArea(
        { x: 100, y: 100, width: 80, height: 80 },
        { x: 0, y: 0, width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 100, y: 100, width: 80, height: 80 });
  });

  it('clamps a rectangle that overflows right/bottom', () => {
    expect(
      clampBoundsToWorkArea(
        { x: 1900, y: 1050, width: 80, height: 80 },
        { x: 0, y: 0, width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 1840, y: 1000, width: 80, height: 80 });
  });

  it('clamps a rectangle against a negative-origin workArea', () => {
    expect(
      clampBoundsToWorkArea(
        { x: -2000, y: -1100, width: 80, height: 80 },
        { x: -1920, y: -1080, width: 1920, height: 1080 },
      ),
    ).toEqual({ x: -1920, y: -1080, width: 80, height: 80 });
  });

  it('keeps a negative-coordinate rectangle inside a negative-origin workArea', () => {
    expect(
      clampBoundsToWorkArea(
        { x: -1000, y: 500, width: 80, height: 80 },
        { x: -1920, y: 0, width: 1920, height: 1080 },
      ),
    ).toEqual({ x: -1000, y: 500, width: 80, height: 80 });
  });
});

describe('isWithinWorkArea', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it('returns true when the rectangle is fully inside', () => {
    expect(isWithinWorkArea({ x: 100, y: 100, width: 80, height: 80 }, workArea)).toBe(true);
  });

  it('returns false when any edge crosses the boundary', () => {
    expect(isWithinWorkArea({ x: 1900, y: 100, width: 80, height: 80 }, workArea)).toBe(false);
    expect(isWithinWorkArea({ x: -1, y: 100, width: 80, height: 80 }, workArea)).toBe(false);
    expect(isWithinWorkArea({ x: 100, y: 100, width: 80, height: 1080 }, workArea)).toBe(false);
  });

  it('handles negative-origin work areas', () => {
    const negative = { x: -1920, y: 0, width: 1920, height: 1080 };
    expect(isWithinWorkArea({ x: -500, y: 100, width: 80, height: 80 }, negative)).toBe(true);
    expect(isWithinWorkArea({ x: 100, y: 100, width: 80, height: 80 }, negative)).toBe(false);
  });
});