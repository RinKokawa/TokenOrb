import { useCallback, useEffect, useRef, useState } from 'react';
import { TokenBall } from './components/TokenBall';
import { TokenPanel } from './components/TokenPanel';
import { Settings } from './pages/Settings';
import {
  createRefreshScheduler,
  type RefreshScheduler,
  type VisibilitySource,
} from './lib/refreshReliability';
import { useTokenStore } from './store/tokenStore';
import type { WindowState } from '../electron/shared/token';

const defaultRefreshInterval = 30;
const refreshOptions = [10, 30, 60, 300];

const getStoredRefreshInterval = (): number => {
  const value = Number(window.localStorage.getItem('token-orb:refresh-interval'));
  return refreshOptions.includes(value) ? value : defaultRefreshInterval;
};

const setWindowState = (view: WindowState): void => {
  void window.electronAPI?.setWindowState(view);
};

const documentVisibility: VisibilitySource = {
  isVisible: () => document.visibilityState === 'visible',
  subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
};

const App = () => {
  const [view, setView] = useState<WindowState>('collapsed');
  const [refreshInterval, setRefreshInterval] = useState(getStoredRefreshInterval);
  const schedulerRef = useRef<RefreshScheduler | null>(null);
  const updateToken = useTokenStore((state) => state.updateToken);

  useEffect(() => {
    const scheduler = createRefreshScheduler({
      intervalMs: refreshInterval * 1_000,
      refresh: updateToken,
      setNextPollAt: useTokenStore.getState().setNextPollAt,
      visibility: documentVisibility,
    });
    schedulerRef.current = scheduler;
    scheduler.start();

    return () => {
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
      scheduler.stop();
    };
  }, [refreshInterval, updateToken]);

  const requestRefresh = useCallback(
    (): Promise<void> => schedulerRef.current?.refreshNow() ?? updateToken(),
    [updateToken],
  );

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onViewChange((nextView) => {
      setView(nextView);
    });
    return unsubscribe;
  }, []);

  const changeView = (nextView: WindowState): void => {
    setView(nextView);
    setWindowState(nextView);
  };

  if (view === 'expanded') {
    return (
      <div className="app-shell">
        <TokenPanel
          onClose={() => changeView('collapsed')}
          onQuit={() => window.electronAPI?.quitApp()}
          onRefresh={requestRefresh}
          onSettings={() => changeView('settings')}
        />
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="app-shell">
        <Settings
          refreshInterval={refreshInterval}
          onBack={() => changeView('collapsed')}
          onRefresh={requestRefresh}
          onRefreshIntervalChange={setRefreshInterval}
        />
      </div>
    );
  }

  return (
    <div className="app-shell flex items-center justify-center">
      <TokenBall onOpen={() => changeView('expanded')} />
    </div>
  );
};

export default App;
