export interface TokenBalance {
  totalPercent: number;
  usedPercent: number;
  remainingPercent: number;
}

export interface TokenPlanModel {
  model: string;
  usedPercent: number;
  remainingPercent: number;
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

export type WindowState = 'collapsed' | 'expanded' | 'settings';
export type WindowViewListener = (view: WindowState) => void;

export type ConfigSecretUpdate =
  | { kind: 'keep' }
  | { kind: 'replace'; value: string | null }
  | { kind: 'clear' };

export interface PublicConfigStatus {
  baseUrl: string;
  groupId: string | null;
  tokenConfigured: boolean;
  cookieConfigured: boolean;
  storageAvailable: boolean;
}

export interface ConfigSaveInput {
  baseUrl: string;
  groupId: string | null;
  token: ConfigSecretUpdate;
  cookieOverride: ConfigSecretUpdate;
}

export type ConfigSaveResult =
  | { ok: true; status: PublicConfigStatus }
  | { ok: false; error: string };

export interface ElectronApi {
  getTokenBalance: () => Promise<TokenBalance>;
  updateTokenBalance: (balance: TokenBalance) => Promise<TokenBalance>;
  fetchTokenPlan: () => Promise<TokenPlanSnapshot | null>;
  getConfigStatus: () => Promise<PublicConfigStatus>;
  saveConfig: (input: ConfigSaveInput) => Promise<ConfigSaveResult>;
  setWindowState: (state: WindowState) => Promise<WindowState>;
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  beginWindowDrag: () => void;
  endWindowDrag: () => void;
  showWindow: () => void;
  hideWindow: () => void;
  quitApp: () => void;
  onViewChange: (listener: WindowViewListener) => () => void;
}

export const createMockTokenPlanSnapshot = (fetchedAt = Date.now()): TokenPlanSnapshot => {
  const primary: TokenPlanModel = {
    model: 'general',
    usedPercent: 30,
    remainingPercent: 70,
    weeklyUsedPercent: 12,
    totalPercent: 100,
    resetAt: 0,
  };

  return {
    fetchedAt,
    baseUrl: 'mock://',
    models: [primary],
    primary,
  };
};
