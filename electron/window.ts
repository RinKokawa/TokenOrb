import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

type WindowDimensions = { width: number; height: number };

export type WindowState = 'collapsed' | 'expanded' | 'settings';

const dimensions: Record<WindowState, WindowDimensions> = {
  collapsed: { width: 96, height: 96 },
  expanded: { width: 340, height: 560 },
  settings: { width: 340, height: 660 },
};

const maxBounds: WindowDimensions = {
  width: Math.max(...Object.values(dimensions).map((d) => d.width)),
  height: Math.max(...Object.values(dimensions).map((d) => d.height)),
};

let mainWindow: BrowserWindow | null = null;
let currentState: WindowState = 'collapsed';
let isQuitting = false;
let dragTimer: ReturnType<typeof setInterval> | null = null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const keepInWorkArea = (window: BrowserWindow, width: number, height: number): void => {
  const workArea = screen.getDisplayMatching(window.getBounds()).workArea;
  const bounds = window.getBounds();
  const x = clamp(bounds.x + bounds.width - width, workArea.x, workArea.x + workArea.width - width);
  const y = clamp(
    bounds.y + bounds.height - height,
    workArea.y,
    workArea.y + workArea.height - height,
  );

  window.setBounds({ x, y, width, height }, false);
};

const placeAtBottomRight = (window: BrowserWindow): void => {
  const workArea = screen.getPrimaryDisplay().workArea;
  const { width, height } = dimensions.collapsed;
  window.setBounds(
    {
      x: workArea.x + workArea.width - width - 24,
      y: workArea.y + workArea.height - height - 24,
      width,
      height,
    },
    false,
  );
};

export const createMainWindow = (preloadPath: string, devServerUrl?: string): BrowserWindow => {
  mainWindow = new BrowserWindow({
    width: dimensions.collapsed.width,
    height: dimensions.collapsed.height,
    minWidth: dimensions.collapsed.width,
    minHeight: dimensions.collapsed.height,
    maxWidth: maxBounds.width,
    maxHeight: maxBounds.height,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  placeAtBottomRight(mainWindow);

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.showInactive();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
};

export const getMainWindow = (): BrowserWindow | null => mainWindow;

export const setWindowState = (state: WindowState): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  currentState = state;
  const { width, height } = dimensions[state];
  keepInWorkArea(mainWindow, width, height);
};

export const getWindowState = (): WindowState => currentState;

export const showMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
};

export const hideMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
};

export const setQuitting = (value: boolean): void => {
  isQuitting = value;
};

export const beginWindowDrag = (): void => {
  if (!mainWindow || dragTimer) return;

  const startCursor = screen.getCursorScreenPoint();
  const startBounds = mainWindow.getBounds();

  dragTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    mainWindow.setPosition(
      startBounds.x + cursor.x - startCursor.x,
      startBounds.y + cursor.y - startCursor.y,
      false,
    );
  }, 16);
};

export const endWindowDrag = (): void => {
  if (!dragTimer) return;
  clearInterval(dragTimer);
  dragTimer = null;
};
