import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import {
  getBalanceRingBgClass,
  getBalanceStroke,
  getBalanceTextClass,
} from '../lib/balanceColor';
import {
  normalizeRefreshError,
  type RefreshErrorCode,
} from '../lib/refreshReliability';
import { getLang, setLang, type Lang, useT } from '../i18n';

type TokenPanelProps = {
  onClose: () => void;
  onQuit: () => void;
  onRefresh: () => Promise<void>;
  onSettings: () => void;
};

type ManualRefreshFeedback =
  | { kind: 'success' }
  | { kind: 'error'; code: RefreshErrorCode }
  | null;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value: number): string => numberFormatter.format(value);

const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

type StatusKey = 'idle' | 'loading' | 'online' | 'mock' | 'unauthorized' | 'offline';

const statusDotMap: Record<StatusKey, string> = {
  idle: 'status-dot-idle',
  loading: 'status-dot-loading',
  online: 'status-dot-online',
  mock: 'status-dot-mock',
  unauthorized: 'status-dot-unauthorized',
  offline: 'status-dot-offline',
};

const langOptions: Lang[] = ['en', 'zh'];

export const TokenPanel = ({ onClose, onQuit, onRefresh, onSettings }: TokenPanelProps) => {
  const {
    snapshot,
    percentage,
    totalPercent,
    isLoading,
    lastFetchedAt,
    status,
    error,
    errorCode,
  } = useTokenStore();
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const [refreshFeedback, setRefreshFeedback] = useState<ManualRefreshFeedback>(null);
  const statusKey = (status as StatusKey) ?? 'idle';
  const statusDot = statusDotMap[statusKey] ?? statusDotMap.idle;
  const statusLabel = t(`status.${statusKey}`);
  const primary = snapshot?.primary ?? null;
  const usedNumeric = Math.max(0, totalPercent - percentage);
  const weeklyUsed = primary?.weeklyUsedPercent ?? 0;
  const ringColor = getBalanceStroke(percentage);
  const ringBg = getBalanceRingBgClass(percentage);
  const ringText = getBalanceTextClass(percentage);
  const lang = getLang();
  const storeError = errorCode ? t(`refresh.error.${errorCode}`) : error;

  const handleRefresh = async (): Promise<void> => {
    setRefreshFeedback(null);
    try {
      await onRefresh();
      setRefreshFeedback({ kind: 'success' });
    } catch (refreshError: unknown) {
      setRefreshFeedback({ kind: 'error', code: normalizeRefreshError(refreshError).code });
    }
  };

  const feedbackMessage =
    refreshFeedback?.kind === 'success'
      ? t('panel.refreshSuccess')
      : refreshFeedback?.kind === 'error'
        ? t(`refresh.error.${refreshFeedback.code}`)
        : null;

  return (
    <motion.section
      className="glass-panel panel-text flex w-[340px] flex-col rounded-2xl p-5"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="panel-eyebrow text-[10px] font-semibold uppercase tracking-[0.22em]">
            {t('panel.eyebrow')}
          </p>
          <h1 className="panel-text-strong mt-1 text-xl font-semibold tracking-tight">
            {t('panel.title')}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label={t('panel.langToggle')}
            className="panel-control-group flex items-center rounded-lg p-0.5 text-[11px] font-medium"
          >
            {langOptions.map((option) => {
              const isActive = lang === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={t('panel.langToggle')}
                  className={`panel-segment-button min-w-[28px] rounded-md px-1.5 py-1 ${
                    isActive ? 'panel-segment-button-active' : ''
                  }`}
                  onClick={() => setLang(option)}
                >
                  {t(`panel.langShort.${option}`)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label={t('panel.settings')}
            title={t('panel.settings')}
            className="panel-icon-button rounded-lg p-2"
            onClick={onSettings}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          <button
            type="button"
            aria-label={t('panel.close')}
            title={t('panel.close')}
            className="panel-icon-button rounded-lg p-2"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className="panel-surface mt-6 flex items-center gap-4 rounded-xl p-4">
        <div
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${ringBg}`}
        >
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <circle
              className="balance-ring-track"
              cx="32"
              cy="32"
              r="25"
              fill="none"
              strokeWidth="4"
            />
            <motion.circle
              cx="32"
              cy="32"
              r="25"
              fill="none"
              stroke={ringColor}
              strokeLinecap="round"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 25}
              animate={{
                stroke: ringColor,
                strokeDashoffset: 2 * Math.PI * 25 * (1 - percentage / 100),
              }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }
              }
            />
          </svg>
          <span className={`text-sm font-semibold ${ringText}`}>{percentage}%</span>
        </div>
        <div>
          <p className="panel-muted text-xs">{t('panel.remaining')}</p>
          <p className="panel-text-strong mt-1 text-2xl font-semibold tracking-tight">
            {formatNumber(percentage)}
          </p>
          <p className="panel-muted mt-1 text-[11px]">
            {t('panel.of', {
              total: formatNumber(totalPercent),
              model: primary?.model ?? '—',
            })}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="panel-surface rounded-xl p-3">
          <p className="panel-muted text-[11px]">{t('panel.used5h')}</p>
          <p className="panel-text-strong mt-2 text-lg font-semibold">
            {formatNumber(usedNumeric)}%
          </p>
        </div>
        <div className="panel-surface rounded-xl p-3">
          <p className="panel-muted text-[11px]">{t('panel.weeklyUsed')}</p>
          <p className="panel-text-strong mt-2 text-lg font-semibold">
            {formatNumber(weeklyUsed)}%
          </p>
        </div>
      </div>

      <div className="panel-surface mt-4 rounded-xl p-3 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="panel-muted">{t('panel.lastFetched')}</span>
          <span className="panel-text-strong font-medium">{formatTimestamp(lastFetchedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="panel-muted">{t('panel.source')}</span>
          <span className="panel-text-strong font-medium">{snapshot?.baseUrl ?? '—'}</span>
        </div>
        {feedbackMessage ? (
          <p
            role={refreshFeedback?.kind === 'error' ? 'alert' : 'status'}
            className={`panel-feedback mt-2 ${
              refreshFeedback?.kind === 'error'
                ? 'panel-feedback-error'
                : 'panel-feedback-success'
            }`}
          >
            {feedbackMessage}
          </p>
        ) : storeError ? (
          <p role="alert" className="panel-feedback panel-feedback-error mt-2">
            {storeError}
          </p>
        ) : null}
      </div>

      <div className="panel-divider-top mt-5 flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true" />
          <span className="panel-muted text-xs font-medium">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="panel-danger-button rounded-lg px-3 py-2 text-xs font-medium"
            onClick={onQuit}
          >
            {t('panel.closeApp')}
          </button>
          <button
            type="button"
            className="panel-primary-button rounded-lg px-3 py-2 text-xs font-semibold"
            disabled={isLoading}
            onClick={() => void handleRefresh()}
          >
            {isLoading ? t('panel.refreshing') : t('panel.refresh')}
          </button>
        </div>
      </div>
    </motion.section>
  );
};
