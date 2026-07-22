import { useEffect, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { useT } from '../i18n';

type Theme = 'dark' | 'light';

type SettingsProps = {
  refreshInterval: number;
  onBack: () => void;
  onRefreshIntervalChange: (value: number) => void;
};

const getStoredTheme = (): Theme => {
  const storedTheme = window.localStorage.getItem('token-orb:theme');
  return storedTheme === 'light' ? 'light' : 'dark';
};

export const Settings = ({ refreshInterval, onBack, onRefreshIntervalChange }: SettingsProps) => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const snapshot = useTokenStore((state) => state.snapshot);
  const lastFetchedAt = useTokenStore((state) => state.lastFetchedAt);
  const status = useTokenStore((state) => state.status);
  const updateToken = useTokenStore((state) => state.updateToken);
  const t = useT();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('token-orb:theme', theme);
  }, [theme]);

  const handleRefreshIntervalChange = (value: number): void => {
    window.localStorage.setItem('token-orb:refresh-interval', String(value));
    onRefreshIntervalChange(value);
  };

  const baseUrl = snapshot?.baseUrl ?? '—';
  const modelsCount = snapshot?.models.length ?? 0;
  const statusLine = t(`settings.status.${status}`);

  return (
    <section className="glass-panel flex w-[320px] flex-col rounded-2xl p-5 text-slate-200">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('settings.back')}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300">
            {t('settings.eyebrow')}
          </p>
          <h1 className="light-text mt-1 text-xl font-semibold tracking-tight">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      <div className="mt-7 space-y-5">
        <div>
          <p className="light-text text-sm font-medium">{t('settings.minimax')}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {t('settings.tokenHint')}
            <code className="mx-1 text-indigo-300">.env</code>
            {t('settings.tokenHintAnd')}
            <code className="mx-1 text-indigo-300">MINIMAX_TOKEN</code>
            {t('settings.tokenHintAnd')}
            <code className="mx-1 text-indigo-300">MINIMAX_GROUP_ID</code>
            {t('settings.tokenHintTail')}
          </p>
          <dl className="mt-3 space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">{t('settings.baseUrl')}</dt>
              <dd className="light-text font-medium">{baseUrl}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">{t('settings.models')}</dt>
              <dd className="light-text font-medium">{modelsCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">{t('settings.lastFetch')}</dt>
              <dd className="light-text font-medium">
                {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">{t('settings.status')}</dt>
              <dd className="light-text font-medium">{statusLine}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
            onClick={() => void updateToken().catch(() => undefined)}
          >
            {t('settings.fetchNow')}
          </button>
        </div>

        <label className="block">
          <span className="light-text text-sm font-medium">{t('settings.refreshFreq')}</span>
          <select
            value={refreshInterval}
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            onChange={(event) => handleRefreshIntervalChange(Number(event.target.value))}
          >
            <option value={10}>{t('settings.refresh.10')}</option>
            <option value={30}>{t('settings.refresh.30')}</option>
            <option value={60}>{t('settings.refresh.60')}</option>
            <option value={300}>{t('settings.refresh.300')}</option>
          </select>
        </label>

        <fieldset>
          <legend className="light-text text-sm font-medium">{t('settings.theme')}</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['dark', 'light'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  theme === option
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
                onClick={() => setTheme(option)}
              >
                {t(`settings.theme.${option}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
};