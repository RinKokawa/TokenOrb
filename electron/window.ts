import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import {
  clampPointToWorkArea,
  computeDragPosition,
  positionResizedBoundsInWorkArea,
  type Point,
  type Rectangle,
  type Size,
} from './window/geometry';
import {
  POSITION_SCHEMA_VERSION,
  resolveRestoredPosition,
  type DisplayInfo,
  type PersistedPosition,
} from './window/persistence';
import { loadPersistedPositionFromDisk, writePersistedPositionToDisk } from './window/store';
import type { WindowState } from './shared/token';

export type { WindowState } from './shared/token';

type WindowDimensions = { width: number; height: number };

const dimensions: Record<WindowState, WindowDimensions> = {
  collapsed: { width: 96, height: 96 },
  expanded: { width: 340, height: 560 },
  settings: { width: 340, height: 660 },
};

const maxBounds: WindowDimensions = {
  width: Math.max(...Object.values(dimensions).map((d) => d.width)),
  height: Math.max(...Object.values(dimensions).map((d) => d.height)),
};

const EDGE_INSET = 24;

let mainWindow: BrowserWindow | null = null;
let currentState: WindowState = 'collapsed';
let isQuitting = false;
let dragTimer: ReturnType<typeof setInterval> | null = null;

const computeFallbackPosition = (
  size: WindowDimensions,
): { x: number; y: number; displayId: number } => {
  const primary = screen.getPrimaryDisplay();
  return {
    x: primary.workArea.x + primary.workArea.width - size.width - EDGE_INSET,
    y: primary.workArea.y + primary.workArea.height - size.height - EDGE_INSET,
    displayId: primary.id,
  };
};

const collectDisplays = (): DisplayInfo[] =>
  screen.getAllDisplays().map((display) => ({
    id: display.id,
    workArea: {
      x: display.workArea.x,
      y: display.workArea.y,
      width: display.workArea.width,
      height: display.workArea.height,
    },
  }));

const resolveStartupPosition = (
  size: WindowDimensions,
): { x: number; y: number; displayId: number } => {
  const saved = loadPersistedPositionFromDisk();
  const fallback = computeFallbackPosition(size);
  return resolveRestoredPosition(saved, collectDisplays(), size, fallback);
};

const keepInWorkArea = (window: BrowserWindow, width: number, height: number): void => {
  const bounds = window.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const next = positionResizedBoundsInWorkArea(
    { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    { width, height },
    workArea,
  );
  window.setBounds(next, false);
};

const persistCurrentPosition = (window: BrowserWindow): void => {
  if (window.isDestroyed()) return;
  const bounds = window.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const position: PersistedPosition = {
    schemaVersion: POSITION_SCHEMA_VERSION,
    x: bounds.x,
    y: bounds.y,
    displayId: display.id,
  };
  try {
    writePersistedPositionToDisk(position);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[window] failed to persist position: ${message}`);
  }
};

const stopDrag = (): void => {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  persistCurrentPosition(mainWindow);
};

export const createMainWindow = (preloadPath: string, devServerUrl?: string): BrowserWindow => {
  const collapsedSize = dimensions.collapsed;
  const restored = resolveStartupPosition(collapsedSize);

  mainWindow = new BrowserWindow({
    width: collapsedSize.width,
    height: collapsedSize.height,
    minWidth: collapsedSize.width,
    minHeight: collapsedSize.height,
    maxWidth: maxBounds.width,
    maxHeight: maxBounds.height,
    x: restored.x,
    y: restored.y,
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

  mainWindow.on('blur', stopDrag);
  mainWindow.on('hide', stopDrag);

  mainWindow.on('closed', () => {
    stopDrag();
    mainWindow = null;
  });

  mainWindow.webContents.on('render-process-gone', () => {
    stopDrag();
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
  if (!mainWindow || mainWindow.isDestroyed() || dragTimer) return;

  const startCursor: Point = screen.getCursorScreenPoint();
  const startBounds = mainWindow.getBounds();
  const startSize: Size = { width: startBounds.width, height: startBounds.height };

  dragTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const cursor: Point = screen.getCursorScreenPoint();
    const next = computeDragPosition(startBounds, startCursor, cursor);
    const targetRectangle: Rectangle = {
      x: next.x,
      y: next.y,
      width: startSize.width,
      height: startSize.height,
    };
    const workArea = screen.getDisplayMatching(targetRectangle).workArea;
    const clamped = clampPointToWorkArea(next, startSize, workArea);
    mainWindow.setPosition(clamped.x, clamped.y, false);
  }, 16);
};

export const endWindowDrag = (): void => {
  stopDrag();
};

export const persistWindowPosition = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  persistCurrentPosition(mainWindow);
};

export const stopWindowDrag = (): void => {
  stopDrag();
};
