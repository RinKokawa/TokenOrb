import { app, ipcMain } from 'electron';
import {
  beginWindowDrag,
  endWindowDrag,
  hideMainWindow,
  setQuitting,
  setWindowState,
  showMainWindow,
  type WindowState,
} from '../window';
import { loadRuntimeConfig, type RuntimeConfig } from '../config';
import {
  fetchTokenPlan,
  InvalidResponseError,
  InvalidTokenError,
  type TokenPlanSnapshot,
} from '../api/minimax';

type TokenBalance = {
  total: number;
  used: number;
  remaining: number;
};

const initialBalance: TokenBalance = {
  total: 1_000_000,
  used: 300_000,
  remaining: 700_000,
};

let tokenBalance = initialBalance;
let lastMockUpdate = Date.now();
let runtimeConfig: RuntimeConfig | null = null;

const isWindowState = (value: unknown): value is WindowState =>
  value === 'collapsed' || value === 'expanded' || value === 'settings';

const isTokenBalance = (value: unknown): value is TokenBalance => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.total === 'number' &&
    Number.isFinite(candidate.total) &&
    candidate.total > 0 &&
    typeof candidate.used === 'number' &&
    Number.isFinite(candidate.used) &&
    candidate.used >= 0 &&
    typeof candidate.remaining === 'number' &&
    Number.isFinite(candidate.remaining) &&
    candidate.remaining >= 0 &&
    candidate.used + candidate.remaining === candidate.total
  );
};

const refreshMockBalance = (): TokenBalance => {
  const now = Date.now();
  const elapsedIntervals = Math.floor((now - lastMockUpdate) / 15_000);

  if (elapsedIntervals > 0) {
    const used = Math.min(tokenBalance.total, tokenBalance.used + elapsedIntervals * 137);
    tokenBalance = {
      total: tokenBalance.total,
      used,
      remaining: tokenBalance.total - used,
    };
    lastMockUpdate = now;
  }

  return tokenBalance;
};

export const setRuntimeConfig = (config: RuntimeConfig): void => {
  runtimeConfig = config;
};

export const registerTokenIpc = (): void => {
  ipcMain.handle('token:get', () => refreshMockBalance());

  ipcMain.handle('token:update', (_event, value: unknown) => {
    if (!isTokenBalance(value)) {
      throw new TypeError('Invalid token balance');
    }

    tokenBalance = value;
    lastMockUpdate = Date.now();
    return tokenBalance;
  });

  ipcMain.handle('token:fetch', async (): Promise<TokenPlanSnapshot | null> => {
    const config = runtimeConfig ?? loadRuntimeConfig();
    if (!config.token) {
      console.warn('[token:fetch] MINIMAX_TOKEN is not configured; using mock balance');
      return null;
    }

    try {
      const snapshot = await fetchTokenPlan({
        baseUrl: config.baseUrl,
        token: config.token,
        groupId: config.groupId,
        cookieOverride: config.cookieOverride,
      });
      console.info(
        `[token:fetch] MiniMax ${config.baseUrl} returned ${snapshot.models.length} model(s); ` +
          `primary=${snapshot.primary?.model ?? 'none'} remains=${snapshot.primary?.remainsPercent ?? 0}%`,
      );
      return snapshot;
    } catch (error: unknown) {
      if (error instanceof InvalidTokenError) {
        console.error('[token:fetch] invalid token', error.message);
      } else if (error instanceof InvalidResponseError) {
        console.error('[token:fetch] invalid response', error.message);
      } else {
        console.error('[token:fetch] unexpected error', error);
      }
      throw error;
    }
  });

  ipcMain.handle('window:set-state', (_event, state: unknown) => {
    if (!isWindowState(state)) {
      throw new TypeError('Invalid window state');
    }

    setWindowState(state);
    return state;
  });

  ipcMain.handle('app:get-auto-launch', () => app.getLoginItemSettings().openAtLogin);

  ipcMain.handle('app:set-auto-launch', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Invalid auto-launch value');
    }

    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.on('window:drag-start', beginWindowDrag);
  ipcMain.on('window:drag-end', endWindowDrag);
  ipcMain.on('window:show', showMainWindow);
  ipcMain.on('window:hide', hideMainWindow);
  ipcMain.on('app:quit', () => {
    setQuitting(true);
    app.quit();
  });
};
