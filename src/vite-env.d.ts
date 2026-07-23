import type { ElectronApi } from '../electron/shared/token';

export {};

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}
