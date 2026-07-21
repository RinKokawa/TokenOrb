import { app } from 'electron';
import path from 'node:path';
import { loadRuntimeConfig } from './config';
import { registerTokenIpc, setRuntimeConfig } from './ipc/token';
import { createTray, destroyTray } from './tray';
import {
  createMainWindow,
  getMainWindow,
  setQuitting,
  setWindowState,
  showMainWindow,
} from './window';

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  const bootstrap = (): void => {
    const config = loadRuntimeConfig();
    setRuntimeConfig(config);
    console.info(
      `[main] MiniMax config baseUrl=${config.baseUrl} token=${
        config.token ? 'configured' : 'missing'
      } group=${config.groupId ?? 'missing'}`,
    );

    registerTokenIpc();
    createMainWindow(path.join(__dirname, 'preload.js'), process.env.VITE_DEV_SERVER_URL);

    createTray({
      onSettings: () => {
        setWindowState('settings');
        showMainWindow();
        getMainWindow()?.webContents.send('view:change', 'settings');
      },
      onQuit: () => {
        setQuitting(true);
        app.quit();
      },
    });
  };

  void app.whenReady().then(bootstrap);

  app.on('activate', () => {
    showMainWindow();
  });

  app.on('before-quit', () => {
    setQuitting(true);
    destroyTray();
  });
}
