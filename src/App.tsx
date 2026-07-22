import { useEffect, useState } from 'react';
import { TokenBall } from './components/TokenBall';
import { TokenPanel } from './components/TokenPanel';
import { Settings } from './pages/Settings';
import { useTokenStore } from './store/tokenStore';

type View = 'collapsed' | 'expanded' | 'settings';

const defaultRefreshInterval = 30;
const refreshOptions = [10, 30, 60, 300];

const getStoredRefreshInterval = (): number => {
  const value = Number(window.localStorage.getItem('token-orb:refresh-interval'));
  return refreshOptions.includes(value) ? value : defaultRefreshInterval;
};

const setWindowState = (view: View): void => {
  void window.electronAPI?.setWindowState(view);
};

const App = () => {
  const [view, setView] = useState<View>('collapsed');
  const [refreshInterval, setRefreshInterval] = useState(getStoredRefreshInterval);
  const updateToken = useTokenStore((state) => state.updateToken);

  useEffect(() => {
    const setNextRefreshAt = useTokenStore.getState().setNextRefreshAt;
    const refresh = (): void => {
      void updateToken().catch(() => undefined);
    };

    refresh();
    setNextRefreshAt(Date.now() + refreshInterval * 1_000);
    const timer = window.setInterval(refresh, refreshInterval * 1_000);
    return () => window.clearInterval(timer);
  }, [refreshInterval, updateToken]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onViewChange((nextView) => {
      setView(nextView);
    });
    return unsubscribe;
  }, []);

  const changeView = (nextView: View): void => {
    setView(nextView);
    setWindowState(nextView);
  };

  if (view === 'expanded') {
    return (
      <div className="app-shell">
        <TokenPanel
          onClose={() => changeView('collapsed')}
          onHide={() => window.electronAPI?.hideWindow()}
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
