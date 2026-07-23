import { create } from 'zustand';
import {
  fetchTokenPlan,
  type TokenBalance,
  type TokenPlanSnapshot,
  type TokenStatus,
} from '../api/token';

export interface TokenState extends TokenBalance {
  percentage: number;
  snapshot: TokenPlanSnapshot | null;
  status: TokenStatus;
  lastFetchedAt: number | null;
  quotaResetAt: number | null;
  nextPollAt: number | null;
  error: string | null;
  isLoading: boolean;
  updateToken: () => Promise<void>;
  setNextPollAt: (timestamp: number | null) => void;
}

const initialBalance: TokenBalance = {
  totalPercent: 0,
  usedPercent: 0,
  remainingPercent: 0,
};

export const useTokenStore = create<TokenState>((set) => ({
  ...initialBalance,
  percentage: 0,
  snapshot: null,
  status: 'idle',
  lastFetchedAt: null,
  quotaResetAt: null,
  nextPollAt: null,
  error: null,
  isLoading: false,
  updateToken: async () => {
    set({ isLoading: true, status: 'loading', error: null });

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
      const message = error instanceof Error ? error.message : 'Unable to load token plan';
      const isAuth = /401|403|unauthor/i.test(message);
      set({ status: isAuth ? 'unauthorized' : 'offline', error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  setNextPollAt: (timestamp) => set({ nextPollAt: timestamp }),
}));
