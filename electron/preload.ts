import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ElectronApi,
  TokenBalance,
  TokenPlanSnapshot,
  WindowState,
  WindowViewListener,
} from './shared/token';

const electronApi: ElectronApi = {
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
  quitApp: (): void => ipcRenderer.send('app:quit'),
  onViewChange: (listener: WindowViewListener): (() => void) => {
    const handler = (_event: IpcRendererEvent, view: WindowState): void => listener(view);
    ipcRenderer.on('view:change', handler);
    return () => ipcRenderer.removeListener('view:change', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
