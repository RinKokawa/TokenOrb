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
  nextRefreshAt: number | null;
  error: string | null;
  isLoading: boolean;
  updateToken: () => Promise<void>;
  setNextRefreshAt: (timestamp: number | null) => void;
}

const initialBalance: TokenBalance = {
  total: 0,
  used: 0,
  remaining: 0,
};

export const useTokenStore = create<TokenState>((set) => ({
  ...initialBalance,
  percentage: 0,
  snapshot: null,
  status: 'idle',
  lastFetchedAt: null,
  nextRefreshAt: null,
  error: null,
  isLoading: false,
  updateToken: async () => {
    set({ isLoading: true, status: 'loading', error: null });

    try {
      const snapshot = await fetchTokenPlan();
      const primary = snapshot.primary;
      const total = primary?.totalPercent ?? 0;
      const remaining = primary?.remainsPercent ?? 0;
      const used = primary?.usedPercent ?? 0;
      const percentage = total > 0 ? Math.round(remaining) : 0;

      set({
        snapshot,
        total,
        used,
        remaining,
        percentage,
        lastFetchedAt: snapshot.fetchedAt,
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
  setNextRefreshAt: (timestamp) => set({ nextRefreshAt: timestamp }),
}));
