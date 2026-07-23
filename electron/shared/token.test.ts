import { describe, expect, it } from 'vitest';
import { createMockTokenPlanSnapshot } from './token';

describe('createMockTokenPlanSnapshot', () => {
  it('creates the same snapshot for the same timestamp', () => {
    const fetchedAt = 1_750_000_000_000;

    expect(createMockTokenPlanSnapshot(fetchedAt)).toEqual(
      createMockTokenPlanSnapshot(fetchedAt),
    );
    expect(createMockTokenPlanSnapshot(fetchedAt)).toMatchObject({
      fetchedAt,
      baseUrl: 'mock://',
    });
  });

  it('uses explicit and internally consistent percentage values', () => {
    const snapshot = createMockTokenPlanSnapshot(1_750_000_000_000);
    const primary = snapshot.primary;

    expect(primary).not.toBeNull();
    expect(primary?.totalPercent).toBe(100);
    expect(primary?.usedPercent).toBe(30);
    expect(primary?.remainingPercent).toBe(70);
    expect((primary?.usedPercent ?? 0) + (primary?.remainingPercent ?? 0)).toBe(
      primary?.totalPercent,
    );
    expect(snapshot.models[0]).toEqual(primary);
  });
});
