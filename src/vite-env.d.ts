import type { TokenBalance, TokenPlanSnapshot } from './api/token';

export {};

type WindowState = 'collapsed' | 'expanded' | 'settings';
type WindowViewListener = (view: WindowState) => void;

declare global {
  interface Window {
    electronAPI?: {
      getTokenBalance: () => Promise<TokenBalance>;
      updateTokenBalance: (balance: TokenBalance) => Promise<TokenBalance>;
      fetchTokenPlan: () => Promise<TokenPlanSnapshot | null>;
      setWindowState: (state: WindowState) => Promise<WindowState>;
      getAutoLaunch: () => Promise<boolean>;
      setAutoLaunch: (enabled: boolean) => Promise<boolean>;
      beginWindowDrag: () => void;
      endWindowDrag: () => void;
      showWindow: () => void;
      hideWindow: () => void;
      onViewChange: (listener: WindowViewListener) => () => void;
    };
  }
}
