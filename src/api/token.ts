import {
  TokenNotConfiguredError,
  isTokenNotConfiguredError,
  type TokenBalance,
  type TokenPlanSnapshot,
} from '../../electron/shared/token';

export type { TokenBalance, TokenPlanModel, TokenPlanSnapshot } from '../../electron/shared/token';

export { isTokenNotConfiguredError };

export type TokenStatus = 'idle' | 'loading' | 'online' | 'unauthorized' | 'offline';

export const getTokenBalance = async (): Promise<TokenBalance> => {
  if (window.electronAPI) {
    return window.electronAPI.getTokenBalance();
  }

  throw new TokenNotConfiguredError('Electron API is not available');
};

export const updateTokenBalance = async (balance: TokenBalance): Promise<TokenBalance> => {
  if (window.electronAPI) {
    return window.electronAPI.updateTokenBalance(balance);
  }

  return balance;
};

export const fetchTokenPlan = async (): Promise<TokenPlanSnapshot> => {
  if (!window.electronAPI) {
    throw new TokenNotConfiguredError('Electron API is not available');
  }

  return window.electronAPI.fetchTokenPlan();
};
