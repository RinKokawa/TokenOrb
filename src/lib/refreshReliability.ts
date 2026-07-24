export type RefreshErrorCode = 'unauthorized' | 'timeout' | 'network' | 'response' | 'unknown';

export type RefreshFailureStatus = 'unauthorized' | 'offline';

const userSafeMessages: Record<RefreshErrorCode, string> = {
  unauthorized: 'Authentication failed. Check your MiniMax credentials and try again.',
  timeout: 'MiniMax took too long to respond. Try again.',
  network: 'Unable to reach MiniMax. Check your connection and try again.',
  response: 'MiniMax returned an unexpected response. Try again.',
  unknown: 'Unable to refresh token usage. Try again.',
};

export class UserSafeRefreshError extends Error {
  readonly code: RefreshErrorCode;
  readonly status: RefreshFailureStatus;

  constructor(code: RefreshErrorCode, status: RefreshFailureStatus) {
    super(userSafeMessages[code]);
    this.name = 'UserSafeRefreshError';
    this.code = code;
    this.status = status;
  }
}

const getErrorText = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : '';
};

export const normalizeRefreshError = (error: unknown): UserSafeRefreshError => {
  if (error instanceof UserSafeRefreshError) return error;

  const text = getErrorText(error);
  if (/\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid (?:token|credentials?)/i.test(text)) {
    return new UserSafeRefreshError('unauthorized', 'unauthorized');
  }
  if (/timed?\s*out|timeout|aborterror/i.test(text)) {
    return new UserSafeRefreshError('timeout', 'offline');
  }
  if (
    /invalidresponseerror|response|not valid json|model_remains|non-zero status|safe destination|\bhttp\s*[45]\d\d\b/i.test(
      text,
    )
  ) {
    return new UserSafeRefreshError('response', 'offline');
  }
  if (/network|fetch failed|request failed|enotfound|econn|dns|socket/i.test(text)) {
    return new UserSafeRefreshError('network', 'offline');
  }
  return new UserSafeRefreshError('unknown', 'offline');
};

const retryBaseDelayMs = 5_000;
const retryMaxDelayMs = 60_000;

export const getRetryDelay = (failureCount: number): number => {
  const exponent = Math.max(0, Math.floor(failureCount) - 1);
  return Math.min(retryMaxDelayMs, retryBaseDelayMs * 2 ** exponent);
};

export const createSingleFlight = <Result>(
  task: () => Promise<Result>,
): (() => Promise<Result>) => {
  let inFlight: Promise<Result> | null = null;

  return () => {
    if (inFlight) return inFlight;

    let result: Promise<Result>;
    try {
      result = task();
    } catch (error: unknown) {
      return Promise.reject(error);
    }

    inFlight = result.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
};

export type VisibilitySource = {
  isVisible: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

type RefreshSchedulerOptions = {
  intervalMs: number;
  refresh: () => Promise<void>;
  setNextPollAt: (timestamp: number | null) => void;
  visibility: VisibilitySource;
};

export type RefreshScheduler = {
  refreshNow: () => Promise<void>;
  start: () => void;
  stop: () => void;
};

export const createRefreshScheduler = ({
  intervalMs,
  refresh,
  setNextPollAt,
  visibility,
}: RefreshSchedulerOptions): RefreshScheduler => {
  let failureCount = 0;
  let inFlight: Promise<void> | null = null;
  let pendingImmediateRefresh = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const clearScheduledPoll = (): void => {
    if (timer !== null) {
      globalThis.clearTimeout(timer);
      timer = null;
    }
  };

  const schedulePoll = (delayMs: number): void => {
    if (!running || !visibility.isVisible()) {
      setNextPollAt(null);
      return;
    }

    clearScheduledPoll();
    setNextPollAt(Date.now() + delayMs);
    timer = globalThis.setTimeout(() => {
      timer = null;
      setNextPollAt(null);
      void refreshNow().catch(() => undefined);
    }, delayMs);
  };

  const refreshNow = (): Promise<void> => {
    if (!running || !visibility.isVisible()) return Promise.resolve();
    if (inFlight) return inFlight;

    clearScheduledPoll();
    setNextPollAt(null);

    let refreshResult: Promise<void>;
    try {
      refreshResult = refresh();
    } catch (error: unknown) {
      refreshResult = Promise.reject(error);
    }

    let succeeded = false;
    inFlight = (async () => {
      try {
        await refreshResult;
        failureCount = 0;
        succeeded = true;
      } catch (error: unknown) {
        failureCount += 1;
        throw error;
      } finally {
        inFlight = null;

        if (!running || !visibility.isVisible()) {
          setNextPollAt(null);
        } else if (pendingImmediateRefresh) {
          pendingImmediateRefresh = false;
          void refreshNow().catch(() => undefined);
        } else {
          schedulePoll(succeeded ? intervalMs : getRetryDelay(failureCount));
        }
      }
    })();

    return inFlight;
  };

  const handleVisibilityChange = (): void => {
    clearScheduledPoll();
    setNextPollAt(null);

    if (!visibility.isVisible()) {
      pendingImmediateRefresh = false;
      return;
    }
    if (inFlight) {
      pendingImmediateRefresh = true;
      return;
    }
    void refreshNow().catch(() => undefined);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    unsubscribe = visibility.subscribe(handleVisibilityChange);

    if (visibility.isVisible()) {
      void refreshNow().catch(() => undefined);
    } else {
      setNextPollAt(null);
    }
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    pendingImmediateRefresh = false;
    clearScheduledPoll();
    unsubscribe?.();
    unsubscribe = null;
    setNextPollAt(null);
  };

  return { refreshNow, start, stop };
};
