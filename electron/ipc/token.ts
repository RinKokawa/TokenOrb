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
  TokenNotConfiguredError,
  type TokenBalance,
  type TokenPlanSnapshot,
} from '../shared/token';
import { fetchTokenPlan, InvalidResponseError, InvalidTokenError } from '../api/minimax';

const initialBalance: TokenBalance = {
  totalPercent: 100,
  usedPercent: 0,
  remainingPercent: 100,
};

let tokenBalance = initialBalance;
let runtimeConfig: RuntimeConfig | null = null;

const isWindowState = (value: unknown): value is WindowState =>
  value === 'collapsed' || value === 'expanded' || value === 'settings';

const isTokenBalance = (value: unknown): value is TokenBalance => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.totalPercent === 'number' &&
    Number.isFinite(candidate.totalPercent) &&
    candidate.totalPercent > 0 &&
    typeof candidate.usedPercent === 'number' &&
    Number.isFinite(candidate.usedPercent) &&
    candidate.usedPercent >= 0 &&
    typeof candidate.remainingPercent === 'number' &&
    Number.isFinite(candidate.remainingPercent) &&
    candidate.remainingPercent >= 0 &&
    candidate.usedPercent + candidate.remainingPercent === candidate.totalPercent
  );
};

export const setRuntimeConfig = (config: RuntimeConfig): void => {
  runtimeConfig = config;
};

export const registerTokenIpc = (): void => {
  ipcMain.handle('token:get', () => tokenBalance);

  ipcMain.handle('token:update', (_event, value: unknown) => {
    if (!isTokenBalance(value)) {
      throw new TypeError('Invalid token balance');
    }

    tokenBalance = value;
    return tokenBalance;
  });

  ipcMain.handle('token:fetch', async (): Promise<TokenPlanSnapshot> => {
    const config = runtimeConfig ?? loadRuntimeConfig();
    if (!config.token) {
      throw new TokenNotConfiguredError(
        'MINIMAX_TOKEN is not configured; open Settings to add credentials.',
      );
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
          `primary=${snapshot.primary?.model ?? 'none'} remaining=${snapshot.primary?.remainingPercent ?? 0}%`,
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
