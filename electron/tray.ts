import { app, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { getMainWindow, setWindowState, showMainWindow, type WindowState } from './window';

type TrayActions = {
  onSettings: () => void;
  onQuit: () => void;
};

let tray: Tray | null = null;

export const createTray = ({ onSettings, onQuit }: TrayActions): void => {
  const iconPath = path.join(__dirname, '../build/tray.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Token Monitor');

  const showView = (view: WindowState): void => {
    setWindowState(view);
    showMainWindow();
    getMainWindow()?.webContents.send('view:change', view);
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Token Monitor', enabled: false },
    { type: 'separator' },
    { label: '显示窗口', click: () => showView('collapsed') },
    { label: '设置', click: onSettings },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked, openAsHidden: true });
      },
    },
    { type: 'separator' },
    { label: '退出', click: onQuit },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showView('collapsed'));
};

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};
