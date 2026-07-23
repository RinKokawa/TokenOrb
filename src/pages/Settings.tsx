import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { useT } from '../i18n';
import type { ConfigSaveInput, PublicConfigStatus } from '../../electron/shared/token';

type Theme = 'dark' | 'light';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

type SettingsProps = {
  refreshInterval: number;
  onBack: () => void;
  onRefreshIntervalChange: (value: number) => void;
};

const getStoredTheme = (): Theme => {
  const storedTheme = window.localStorage.getItem('token-orb:theme');
  return storedTheme === 'light' ? 'light' : 'dark';
};

const isElectronApiAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

export const Settings = ({ refreshInterval, onBack, onRefreshIntervalChange }: SettingsProps) => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const snapshot = useTokenStore((state) => state.snapshot);
  const lastFetchedAt = useTokenStore((state) => state.lastFetchedAt);
  const status = useTokenStore((state) => state.status);
  const updateToken = useTokenStore((state) => state.updateToken);
  const t = useT();

  const [configStatus, setConfigStatus] = useState<PublicConfigStatus | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(false);
  const [baseUrlInput, setBaseUrlInput] = useState<string>('');
  const [groupIdInput, setGroupIdInput] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [cookieInput, setCookieInput] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('token-orb:theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isElectronApiAvailable() || !window.electronAPI?.getConfigStatus) return;

    const api = window.electronAPI;
    let cancelled = false;
    setConfigLoading(true);
    Promise.resolve(api.getConfigStatus())
      .then((statusResult) => {
        if (cancelled) return;
        setConfigStatus(statusResult);
        setBaseUrlInput(statusResult.baseUrl);
        setGroupIdInput(statusResult.groupId ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setConfigStatus(null);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefreshIntervalChange = (value: number): void => {
    window.localStorage.setItem('token-orb:refresh-interval', String(value));
    onRefreshIntervalChange(value);
  };

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!isElectronApiAvailable() || !window.electronAPI?.getConfigStatus) return;
    try {
      const next = await window.electronAPI.getConfigStatus();
      setConfigStatus(next);
      setBaseUrlInput((current) => (current === '' || current === next.baseUrl ? next.baseUrl : current));
      setGroupIdInput((current) => {
        if (current !== '') return current;
        return next.groupId ?? '';
      });
    } catch {
      setConfigStatus(null);
    }
  }, []);

  const tokenConfigured = configStatus?.tokenConfigured ?? false;
  const cookieConfigured = configStatus?.cookieConfigured ?? false;
  const storageAvailable = configStatus?.storageAvailable ?? false;

  const feedbackKey = useMemo<SaveStatus>(() => saveStatus, [saveStatus]);

  const handleClearToken = (): void => {
    setTokenInput('');
    setSaveStatus('idle');
    setFeedback(null);
  };

  const handleClearCookie = (): void => {
    setCookieInput('');
    setSaveStatus('idle');
    setFeedback(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!isElectronApiAvailable() || !window.electronAPI?.saveConfig) {
      setSaveStatus('error');
      setSaveError(t('settings.config.unavailable'));
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);
    setFeedback(null);

    const trimmedBaseUrl = baseUrlInput.trim();
    const trimmedGroupId = groupIdInput.trim();

    const tokenUpdate: ConfigSaveInput['token'] =
      tokenInput.length > 0
        ? { kind: 'replace', value: tokenInput }
        : tokenConfigured
          ? { kind: 'clear' }
          : { kind: 'keep' };

    const cookieUpdate: ConfigSaveInput['cookieOverride'] =
      cookieInput.length > 0
        ? { kind: 'replace', value: cookieInput }
        : cookieConfigured
          ? { kind: 'clear' }
          : { kind: 'keep' };

    const payload: ConfigSaveInput = {
      baseUrl: trimmedBaseUrl,
      groupId: trimmedGroupId.length > 0 ? trimmedGroupId : null,
      token: tokenUpdate,
      cookieOverride: cookieUpdate,
    };

    try {
      const result = await window.electronAPI.saveConfig(payload);
      if (result.ok) {
        setConfigStatus(result.status);
        setBaseUrlInput(result.status.baseUrl);
        setGroupIdInput(result.status.groupId ?? '');
        setTokenInput('');
        setCookieInput('');
        setSaveStatus('success');
        setFeedback(t('settings.config.saved'));
        await refreshStatus();
      } else {
        setSaveStatus('error');
        setSaveError(result.error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save config';
      setSaveStatus('error');
      setSaveError(message);
    }
  };

  const baseUrl = snapshot?.baseUrl ?? '—';
  const modelsCount = snapshot?.models.length ?? 0;
  const statusLine = t(`settings.status.${status}`);

  return (
    <section className="glass-panel flex max-h-[640px] w-[340px] flex-col overflow-y-auto rounded-2xl p-5 text-slate-200">
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

        <form className="space-y-3" onSubmit={(e) => void handleSave(e)}>
          <div>
            <p className="light-text text-sm font-medium">{t('settings.config.title')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              {t('settings.config.hint')}
            </p>
            {!storageAvailable ? (
              <p className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
                {t('settings.config.storageMissing')}
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="light-text text-sm font-medium">{t('settings.config.baseUrlLabel')}</span>
            <input
              type="url"
              autoComplete="off"
              spellCheck={false}
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder="https://www.minimaxi.com"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            />
          </label>

          <label className="block">
            <span className="light-text text-sm font-medium">{t('settings.config.groupIdLabel')}</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={groupIdInput}
              onChange={(event) => setGroupIdInput(event.target.value)}
              placeholder={t('settings.config.groupIdPlaceholder')}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="light-text text-sm font-medium">{t('settings.config.tokenLabel')}</span>
              <span className={`text-[10px] font-medium ${tokenConfigured ? 'text-emerald-300' : 'text-[var(--muted)]'}`}>
                {tokenConfigured
                  ? t('settings.config.configured')
                  : t('settings.config.notConfigured')}
              </span>
            </div>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder={
                tokenConfigured
                  ? t('settings.config.keepPlaceholder')
                  : t('settings.config.tokenPlaceholder')
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>{t('settings.config.tokenHintRow')}</span>
              <button
                type="button"
                onClick={handleClearToken}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!tokenConfigured && tokenInput.length === 0}
              >
                {t('settings.config.clearToken')}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="light-text text-sm font-medium">{t('settings.config.cookieLabel')}</span>
              <span className={`text-[10px] font-medium ${cookieConfigured ? 'text-emerald-300' : 'text-[var(--muted)]'}`}>
                {cookieConfigured
                  ? t('settings.config.configured')
                  : t('settings.config.notConfigured')}
              </span>
            </div>
            <textarea
              autoComplete="off"
              spellCheck={false}
              rows={2}
              value={cookieInput}
              onChange={(event) => setCookieInput(event.target.value)}
              placeholder={
                cookieConfigured
                  ? t('settings.config.keepPlaceholder')
                  : t('settings.config.cookiePlaceholder')
              }
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>{t('settings.config.cookieHintRow')}</span>
              <button
                type="button"
                onClick={handleClearCookie}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!cookieConfigured && cookieInput.length === 0}
              >
                {t('settings.config.clearCookie')}
              </button>
            </div>
          </div>

          {feedback ? (
            <p className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
              {feedback}
            </p>
          ) : null}
          {saveError ? (
            <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
              {saveError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saveStatus === 'saving' || configLoading || !storageAvailable}
            className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
          >
            {feedbackKey === 'saving' ? t('settings.config.saving') : t('settings.config.save')}
          </button>
        </form>

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

export type { SaveStatus };
