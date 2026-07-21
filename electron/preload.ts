import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type TokenBalance = {
  total: number;
  used: number;
  remaining: number;
};

type TokenPlanModel = {
  model: string;
  usedPercent: number;
  remainsPercent: number;
  weeklyUsedPercent: number;
  totalPercent: number;
  resetAt: number;
};

type TokenPlanSnapshot = {
  fetchedAt: number;
  baseUrl: string;
  models: TokenPlanModel[];
  primary: TokenPlanModel | null;
};

type WindowState = 'collapsed' | 'expanded' | 'settings';

type WindowViewListener = (view: WindowState) => void;

const electronApi = {
  getTokenBalance: (): Promise<TokenBalance> => ipcRenderer.invoke('token:get'),
  updateTokenBalance: (value: TokenBalance): Promise<TokenBalance> =>
    ipcRenderer.invoke('token:update', value),
  fetchTokenPlan: (): Promise<TokenPlanSnapshot | null> => ipcRenderer.invoke('token:fetch'),
  setWindowState: (state: WindowState): Promise<WindowState> =>
    ipcRenderer.invoke('window:set-state', state),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('app:set-auto-launch', enabled),
  beginWindowDrag: (): void => ipcRenderer.send('window:drag-start'),
  endWindowDrag: (): void => ipcRenderer.send('window:drag-end'),
  showWindow: (): void => ipcRenderer.send('window:show'),
  hideWindow: (): void => ipcRenderer.send('window:hide'),
  onViewChange: (listener: WindowViewListener): (() => void) => {
    const handler = (_event: IpcRendererEvent, view: WindowState): void => listener(view);
    ipcRenderer.on('view:change', handler);
    return () => ipcRenderer.removeListener('view:change', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
