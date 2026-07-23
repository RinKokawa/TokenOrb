import {
  createMockTokenPlanSnapshot,
  type TokenBalance,
  type TokenPlanSnapshot,
} from '../../electron/shared/token';

export type { TokenBalance, TokenPlanModel, TokenPlanSnapshot } from '../../electron/shared/token';

export type TokenStatus = 'idle' | 'loading' | 'online' | 'mock' | 'unauthorized' | 'offline';

const mockStartedAt = Date.now();
const mockTotalPercent = 100;

const getMockTokenBalance = (): TokenBalance => {
  const elapsedIntervals = Math.floor((Date.now() - mockStartedAt) / 15_000);
  const usedPercent = Math.min(mockTotalPercent, 30 + elapsedIntervals * 0.0137);

  return {
    totalPercent: mockTotalPercent,
    usedPercent,
    remainingPercent: mockTotalPercent - usedPercent,
  };
};

export const getTokenBalance = async (): Promise<TokenBalance> => {
  if (window.electronAPI) {
    return window.electronAPI.getTokenBalance();
  }

  return getMockTokenBalance();
};

export const updateTokenBalance = async (balance: TokenBalance): Promise<TokenBalance> => {
  if (window.electronAPI) {
    return window.electronAPI.updateTokenBalance(balance);
  }

  return balance;
};

export const fetchTokenPlan = async (): Promise<TokenPlanSnapshot> => {
  if (!window.electronAPI) {
    return createMockTokenPlanSnapshot();
  }

  const snapshot = await window.electronAPI.fetchTokenPlan();
  if (snapshot) return snapshot;

  // When MINIMAX_TOKEN is not configured, fall back to a deterministic mock
  // so the UI still animates and the mock source of truth can be observed.
  return createMockTokenPlanSnapshot();
};
