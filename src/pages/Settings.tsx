import { useCallback, useEffect, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { normalizeRefreshError, type RefreshErrorCode } from '../lib/refreshReliability';
import {
  accentOptions,
  getStoredAccent,
  getStoredTheme,
  setStoredAccent,
  setStoredTheme,
  type Accent,
  type Theme,
} from '../lib/theme';
import { useT } from '../i18n';
import type { ConfigSaveInput, PublicConfigStatus } from '../../electron/shared/token';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

type ManualRefreshFeedback = { kind: 'success' } | { kind: 'error'; code: RefreshErrorCode } | null;

type SettingsProps = {
  refreshInterval: number;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onRefreshIntervalChange: (value: number) => void;
};

const isElectronApiAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

export const Settings = ({
  refreshInterval,
  onBack,
  onRefresh,
  onRefreshIntervalChange,
}: SettingsProps) => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [accent, setAccent] = useState<Accent>(getStoredAccent);
  const snapshot = useTokenStore((state) => state.snapshot);
  const lastFetchedAt = useTokenStore((state) => state.lastFetchedAt);
  const status = useTokenStore((state) => state.status);
  const isLoading = useTokenStore((state) => state.isLoading);
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
  const [refreshFeedback, setRefreshFeedback] = useState<ManualRefreshFeedback>(null);

  useEffect(() => {
    setStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    setStoredAccent(accent);
  }, [accent]);

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
      setBaseUrlInput((current) =>
        current === '' || current === next.baseUrl ? next.baseUrl : current,
      );
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

  const handleFetchNow = async (): Promise<void> => {
    setRefreshFeedback(null);
    try {
      await onRefresh();
      setRefreshFeedback({ kind: 'success' });
    } catch (refreshError: unknown) {
      setRefreshFeedback({ kind: 'error', code: normalizeRefreshError(refreshError).code });
    }
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
  const refreshFeedbackMessage =
    refreshFeedback?.kind === 'success'
      ? t('settings.fetchSuccess')
      : refreshFeedback?.kind === 'error'
        ? t(`refresh.error.${refreshFeedback.code}`)
        : null;

  return (
    <section className="glass-panel panel-text flex max-h-[640px] w-[340px] flex-col overflow-y-auto rounded-2xl p-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('settings.back')}
          className="panel-icon-button rounded-lg p-2"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <p className="panel-eyebrow text-[10px] font-semibold uppercase tracking-[0.22em]">
            {t('settings.eyebrow')}
          </p>
          <h1 className="panel-text-strong mt-1 text-xl font-semibold tracking-tight">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      <div className="mt-7 space-y-5">
        <div>
          <p className="panel-text-strong text-sm font-medium">{t('settings.minimax')}</p>
          <p className="panel-muted mt-1 text-[11px] leading-relaxed">
            {t('settings.tokenHint')}
            <code className="panel-code mx-1">.env</code>
            {t('settings.tokenHintAnd')}
            <code className="panel-code mx-1">MINIMAX_TOKEN</code>
            {t('settings.tokenHintTail')}
          </p>
          <dl className="mt-3 space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <dt className="panel-muted">{t('settings.baseUrl')}</dt>
              <dd className="panel-text-strong font-medium">{baseUrl}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="panel-muted">{t('settings.models')}</dt>
              <dd className="panel-text-strong font-medium">{modelsCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="panel-muted">{t('settings.lastFetch')}</dt>
              <dd className="panel-text-strong font-medium">
                {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="panel-muted">{t('settings.status')}</dt>
              <dd className="panel-text-strong font-medium">{statusLine}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="panel-primary-button mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold"
            disabled={isLoading}
            onClick={() => void handleFetchNow()}
          >
            {isLoading ? t('settings.fetching') : t('settings.fetchNow')}
          </button>
          {refreshFeedbackMessage ? (
            <p
              role={refreshFeedback?.kind === 'error' ? 'alert' : 'status'}
              className={`panel-feedback mt-2 ${
                refreshFeedback?.kind === 'error'
                  ? 'panel-feedback-error'
                  : 'panel-feedback-success'
              }`}
            >
              {refreshFeedbackMessage}
            </p>
          ) : null}
        </div>

        <form className="space-y-3" onSubmit={(event) => void handleSave(event)}>
          <div>
            <p className="panel-text-strong text-sm font-medium">{t('settings.config.title')}</p>
            <p className="panel-muted mt-1 text-[11px] leading-relaxed">
              {t('settings.config.hint')}
            </p>
            {!storageAvailable ? (
              <p className="panel-feedback panel-feedback-error mt-2">
                {t('settings.config.storageMissing')}
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="panel-text-strong text-sm font-medium">
              {t('settings.config.baseUrlLabel')}
            </span>
            <input
              type="url"
              autoComplete="off"
              spellCheck={false}
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder="https://www.minimaxi.com"
              className="panel-input mt-2 w-full rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="panel-text-strong text-sm font-medium">
              {t('settings.config.groupIdLabel')}
            </span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={groupIdInput}
              onChange={(event) => setGroupIdInput(event.target.value)}
              placeholder={t('settings.config.groupIdPlaceholder')}
              className="panel-input mt-2 w-full rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="panel-text-strong text-sm font-medium">
                {t('settings.config.tokenLabel')}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  tokenConfigured ? 'panel-success-text' : 'panel-muted'
                }`}
              >
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
              className="panel-input mt-2 w-full rounded-lg px-3 py-2 text-sm"
            />
            <div className="panel-muted mt-1 flex items-center justify-between text-[10px]">
              <span>{t('settings.config.tokenHintRow')}</span>
              <button
                type="button"
                onClick={handleClearToken}
                className="panel-clear-button rounded px-2 py-0.5 text-[10px] font-medium"
                disabled={!tokenConfigured && tokenInput.length === 0}
              >
                {t('settings.config.clearToken')}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="panel-text-strong text-sm font-medium">
                {t('settings.config.cookieLabel')}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  cookieConfigured ? 'panel-success-text' : 'panel-muted'
                }`}
              >
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
              className="panel-input mt-2 w-full resize-y rounded-lg px-3 py-2 text-sm"
            />
            <div className="panel-muted mt-1 flex items-center justify-between text-[10px]">
              <span>{t('settings.config.cookieHintRow')}</span>
              <button
                type="button"
                onClick={handleClearCookie}
                className="panel-clear-button rounded px-2 py-0.5 text-[10px] font-medium"
                disabled={!cookieConfigured && cookieInput.length === 0}
              >
                {t('settings.config.clearCookie')}
              </button>
            </div>
          </div>

          {feedback ? (
            <p role="status" className="panel-feedback panel-feedback-success">
              {feedback}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="panel-feedback panel-feedback-error">
              {saveError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saveStatus === 'saving' || configLoading || !storageAvailable}
            className="panel-primary-button w-full rounded-lg px-3 py-2 text-xs font-semibold"
          >
            {saveStatus === 'saving' ? t('settings.config.saving') : t('settings.config.save')}
          </button>
        </form>

        <label className="block">
          <span className="panel-text-strong text-sm font-medium">{t('settings.refreshFreq')}</span>
          <select
            value={refreshInterval}
            className="panel-input mt-3 w-full rounded-lg px-3 py-2 text-sm"
            onChange={(event) => handleRefreshIntervalChange(Number(event.target.value))}
          >
            <option value={10}>{t('settings.refresh.10')}</option>
            <option value={30}>{t('settings.refresh.30')}</option>
            <option value={60}>{t('settings.refresh.60')}</option>
            <option value={300}>{t('settings.refresh.300')}</option>
          </select>
        </label>

        <fieldset>
          <legend className="panel-text-strong text-sm font-medium">{t('settings.theme')}</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['dark', 'light'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                className={`panel-theme-button rounded-lg px-3 py-2 text-sm ${
                  theme === option ? 'panel-theme-button-active' : ''
                }`}
                onClick={() => setTheme(option)}
              >
                {t(`settings.theme.${option}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="panel-text-strong text-sm font-medium">{t('settings.accent')}</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {accentOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={accent === option}
                className={`panel-theme-button appearance-accent-option rounded-lg px-3 py-2 text-sm ${
                  accent === option ? 'panel-theme-button-active' : ''
                }`}
                onClick={() => setAccent(option)}
              >
                <span className={`accent-swatch accent-swatch-${option}`} aria-hidden="true" />
                {t(`settings.accent.${option}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
};

export type { SaveStatus };
