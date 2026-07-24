import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRefreshScheduler,
  createSingleFlight,
  getRetryDelay,
  normalizeRefreshError,
  type VisibilitySource,
} from './refreshReliability';

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createVisibilitySource = (initialState: 'visible' | 'hidden') => {
  let state = initialState;
  const listeners = new Set<() => void>();
  const source: VisibilitySource = {
    isVisible: () => state === 'visible',
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    source,
    setState: (nextState: 'visible' | 'hidden'): void => {
      state = nextState;
      listeners.forEach((listener) => listener());
    },
  };
};

describe('getRetryDelay', () => {
  it('uses modest exponential backoff capped at one minute', () => {
    expect(getRetryDelay(1)).toBe(5_000);
    expect(getRetryDelay(2)).toBe(10_000);
    expect(getRetryDelay(3)).toBe(20_000);
    expect(getRetryDelay(4)).toBe(40_000);
    expect(getRetryDelay(5)).toBe(60_000);
    expect(getRetryDelay(20)).toBe(60_000);
  });
});

describe('normalizeRefreshError', () => {
  it.each([
    ['remote invocation failed: HTTP 401 token=secret-value', 'unauthorized', 'unauthorized'],
    ['MiniMax request timed out', 'timeout', 'offline'],
    ['getaddrinfo ENOTFOUND api.example.test', 'network', 'offline'],
    ['MiniMax response was not valid JSON', 'response', 'offline'],
  ] as const)('normalizes %s as %s', (rawMessage, code, status) => {
    const normalized = normalizeRefreshError(new Error(rawMessage));

    expect(normalized).toMatchObject({ code, status });
    expect(normalized.message).not.toContain(rawMessage);
    expect(normalized.message).not.toContain('secret-value');
    expect(normalized.message).not.toContain('api.example.test');
  });

  it('uses a safe generic message for unknown thrown values', () => {
    const normalized = normalizeRefreshError({ token: 'secret-value' });

    expect(normalized).toMatchObject({
      code: 'unknown',
      status: 'offline',
      message: 'Unable to refresh token usage. Try again.',
    });
  });

  it('returns an already-normalized error unchanged', () => {
    const normalized = normalizeRefreshError(new Error('HTTP 403'));

    expect(normalizeRefreshError(normalized)).toBe(normalized);
  });
});

describe('createSingleFlight', () => {
  it('shares an in-flight task and allows a new task after settlement', async () => {
    let resolveFirst: ((value: string) => void) | undefined;
    const firstTask = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const task = vi.fn().mockReturnValueOnce(firstTask).mockResolvedValueOnce('second');
    const run = createSingleFlight(task);

    const first = run();
    const duplicate = run();

    expect(duplicate).toBe(first);
    expect(task).toHaveBeenCalledTimes(1);

    resolveFirst?.('first');
    await expect(first).resolves.toBe('first');
    await expect(run()).resolves.toBe('second');
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe('createRefreshScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels polling while hidden and refreshes immediately when visible again', async () => {
    const visibility = createVisibilitySource('visible');
    const refresh = vi.fn().mockResolvedValue(undefined);
    const nextPollValues: Array<number | null> = [];
    const scheduler = createRefreshScheduler({
      intervalMs: 30_000,
      refresh,
      visibility: visibility.source,
      setNextPollAt: (timestamp) => nextPollValues.push(timestamp),
    });

    scheduler.start();
    expect(refresh).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(nextPollValues.at(-1)).toBe(1_030_000);

    visibility.setState('hidden');
    expect(nextPollValues.at(-1)).toBeNull();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    visibility.setState('visible');
    expect(refresh).toHaveBeenCalledTimes(2);
    await flushPromises();
    expect(nextPollValues.at(-1)).toBe(Date.now() + 30_000);

    scheduler.stop();
  });

  it('backs off after failures and restores the normal interval after success', async () => {
    const visibility = createVisibilitySource('visible');
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValueOnce(undefined);
    const nextPollValues: Array<number | null> = [];
    const scheduler = createRefreshScheduler({
      intervalMs: 30_000,
      refresh,
      visibility: visibility.source,
      setNextPollAt: (timestamp) => nextPollValues.push(timestamp),
    });

    scheduler.start();
    await flushPromises();
    expect(nextPollValues.at(-1)).toBe(1_005_000);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(nextPollValues.at(-1)).toBe(1_015_000);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(nextPollValues.at(-1)).toBe(1_045_000);

    scheduler.stop();
  });

  it('queues one immediate refresh after visibility returns during an in-flight call', async () => {
    const visibility = createVisibilitySource('visible');
    let resolveFirst: (() => void) | undefined;
    const firstRefresh = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const refresh = vi.fn().mockReturnValueOnce(firstRefresh).mockResolvedValueOnce(undefined);
    const scheduler = createRefreshScheduler({
      intervalMs: 30_000,
      refresh,
      visibility: visibility.source,
      setNextPollAt: vi.fn(),
    });

    scheduler.start();
    visibility.setState('hidden');
    visibility.setState('visible');
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(2);
    await flushPromises();

    scheduler.stop();
  });
});
