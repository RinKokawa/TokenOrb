export interface TokenBalance {
  total: number;
  used: number;
  remaining: number;
}

export interface TokenPlanModel {
  model: string;
  usedPercent: number;
  remainsPercent: number;
  weeklyUsedPercent: number;
  totalPercent: number;
  resetAt: number;
}

export interface TokenPlanSnapshot {
  fetchedAt: number;
  baseUrl: string;
  models: TokenPlanModel[];
  primary: TokenPlanModel | null;
}

export type TokenStatus = 'idle' | 'loading' | 'online' | 'mock' | 'unauthorized' | 'offline';

const mockStartedAt = Date.now();
const mockTotal = 1_000_000;

const getMockTokenBalance = (): TokenBalance => {
  const elapsedIntervals = Math.floor((Date.now() - mockStartedAt) / 15_000);
  const used = Math.min(mockTotal, 300_000 + elapsedIntervals * 137);

  return {
    total: mockTotal,
    used,
    remaining: mockTotal - used,
  };
};

const getMockSnapshot = (): TokenPlanSnapshot => {
  const remaining = 70;
  return {
    fetchedAt: Date.now(),
    baseUrl: 'mock://',
    models: [
      {
        model: 'general',
        usedPercent: 30,
        remainsPercent: remaining,
        weeklyUsedPercent: 12,
        totalPercent: 100,
        resetAt: 0,
      },
    ],
    primary: {
      model: 'general',
      usedPercent: 30,
      remainsPercent: remaining,
      weeklyUsedPercent: 12,
      totalPercent: 100,
      resetAt: 0,
    },
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
    return getMockSnapshot();
  }

  const snapshot = await window.electronAPI.fetchTokenPlan();
  if (snapshot) return snapshot;

  // When MINIMAX_TOKEN is not configured, fall back to a deterministic mock
  // so the UI still animates and the mock source of truth can be observed.
  return getMockSnapshot();
};
