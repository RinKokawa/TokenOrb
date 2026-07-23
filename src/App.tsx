import { useEffect, useState } from 'react';
import { TokenBall } from './components/TokenBall';
import { TokenPanel } from './components/TokenPanel';
import { Settings } from './pages/Settings';
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

const App = () => {
  const [view, setView] = useState<WindowState>('collapsed');
  const [refreshInterval, setRefreshInterval] = useState(getStoredRefreshInterval);
  const updateToken = useTokenStore((state) => state.updateToken);

  useEffect(() => {
    const setNextPollAt = useTokenStore.getState().setNextPollAt;
    const refresh = async (): Promise<void> => {
      try {
        await updateToken();
      } catch {
        // The store exposes the normalized error to the UI.
      } finally {
        setNextPollAt(Date.now() + refreshInterval * 1_000);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), refreshInterval * 1_000);
    return () => {
      window.clearInterval(timer);
      setNextPollAt(null);
    };
  }, [refreshInterval, updateToken]);

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
          onRefresh={() => void updateToken().catch(() => undefined)}
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
