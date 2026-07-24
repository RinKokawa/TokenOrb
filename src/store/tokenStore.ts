import { create } from 'zustand';
import {
  fetchTokenPlan,
  type TokenBalance,
  type TokenPlanSnapshot,
  type TokenStatus,
} from '../api/token';
import {
  createSingleFlight,
  normalizeRefreshError,
  type RefreshErrorCode,
} from '../lib/refreshReliability';

export interface TokenState extends TokenBalance {
  percentage: number;
  snapshot: TokenPlanSnapshot | null;
  status: TokenStatus;
  lastFetchedAt: number | null;
  quotaResetAt: number | null;
  nextPollAt: number | null;
  error: string | null;
  errorCode: RefreshErrorCode | null;
  isLoading: boolean;
  updateToken: () => Promise<void>;
  setNextPollAt: (timestamp: number | null) => void;
}

const initialBalance: TokenBalance = {
  totalPercent: 0,
  usedPercent: 0,
  remainingPercent: 0,
};

export const useTokenStore = create<TokenState>((set) => {
  const updateToken = createSingleFlight(async () => {
    set({ isLoading: true, status: 'loading', error: null, errorCode: null });

    try {
      const snapshot = await fetchTokenPlan();
      const primary = snapshot.primary;
      const totalPercent = primary?.totalPercent ?? 0;
      const remainingPercent = primary?.remainingPercent ?? 0;
      const usedPercent = primary?.usedPercent ?? 0;
      const percentage = totalPercent > 0 ? Math.round(remainingPercent) : 0;

      set({
        snapshot,
        totalPercent,
        usedPercent,
        remainingPercent,
        percentage,
        lastFetchedAt: snapshot.fetchedAt,
        quotaResetAt: primary?.resetAt || null,
        status: snapshot.baseUrl.startsWith('mock://') ? 'mock' : 'online',
      });
    } catch (error: unknown) {
      const normalized = normalizeRefreshError(error);
      set({ status: normalized.status, error: normalized.message, errorCode: normalized.code });
      throw normalized;
    } finally {
      set({ isLoading: false });
    }
  });

  return {
    ...initialBalance,
    percentage: 0,
    snapshot: null,
    status: 'idle',
    lastFetchedAt: null,
    quotaResetAt: null,
    nextPollAt: null,
    error: null,
    errorCode: null,
    isLoading: false,
    updateToken,
    setNextPollAt: (timestamp) => set({ nextPollAt: timestamp }),
  };
});
