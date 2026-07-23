import { motion } from 'framer-motion';
import { useTokenStore } from '../store/tokenStore';
import {
  getBalanceRingBgClass,
  getBalanceStroke,
  getBalanceTextClass,
} from '../lib/balanceColor';
import { getLang, setLang, type Lang, useT } from '../i18n';

type TokenPanelProps = {
  onClose: () => void;
  onQuit: () => void;
  onRefresh: () => void;
  onSettings: () => void;
};

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
  idle: 'bg-slate-400',
  loading: 'bg-amber-300',
  online: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
  mock: 'bg-indigo-300',
  unauthorized: 'bg-rose-400',
  offline: 'bg-amber-500',
};

const langOptions: Lang[] = ['en', 'zh'];

export const TokenPanel = ({ onClose, onQuit, onRefresh, onSettings }: TokenPanelProps) => {
  const { snapshot, percentage, totalPercent, isLoading, lastFetchedAt, status, error } =
    useTokenStore();
  const t = useT();
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

  return (
    <motion.section
      className="glass-panel flex w-[340px] flex-col rounded-2xl p-5 text-slate-200"
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300">
            {t('panel.eyebrow')}
          </p>
          <h1 className="light-text mt-1 text-xl font-semibold tracking-tight">
            {t('panel.title')}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label={t('panel.langToggle')}
            className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-[11px] font-medium"
          >
            {langOptions.map((option) => {
              const isActive = lang === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={t('panel.langToggle')}
                  className={`min-w-[28px] rounded-md px-1.5 py-1 transition ${
                    isActive
                      ? 'bg-indigo-500 text-white shadow'
                      : 'text-[var(--muted)] hover:text-white'
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
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            onClick={onSettings}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          <button
            type="button"
            aria-label={t('panel.close')}
            title={t('panel.close')}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${ringBg}`}>
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <circle
              cx="32"
              cy="32"
              r="25"
              fill="none"
              stroke="rgba(255,255,255,0.10)"
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
            />
          </svg>
          <span className={`text-sm font-semibold ${ringText}`}>{percentage}%</span>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">{t('panel.remaining')}</p>
          <p className="light-text mt-1 text-2xl font-semibold tracking-tight">
            {formatNumber(percentage)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {t('panel.of', {
              total: formatNumber(totalPercent),
              model: primary?.model ?? '—',
            })}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[var(--muted)]">{t('panel.used5h')}</p>
          <p className="light-text mt-2 text-lg font-semibold">{formatNumber(usedNumeric)}%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[var(--muted)]">{t('panel.weeklyUsed')}</p>
          <p className="light-text mt-2 text-lg font-semibold">{formatNumber(weeklyUsed)}%</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">{t('panel.lastFetched')}</span>
          <span className="light-text font-medium">{formatTimestamp(lastFetchedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[var(--muted)]">{t('panel.source')}</span>
          <span className="light-text font-medium">{snapshot?.baseUrl ?? '—'}</span>
        </div>
        {error ? <p className="mt-2 text-rose-300">{error}</p> : null}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className="text-xs font-medium text-[var(--muted)]">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-medium text-rose-300/90 transition hover:bg-rose-500/15 hover:text-rose-200"
            onClick={onQuit}
          >
            {t('panel.closeApp')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={onRefresh}
          >
            {isLoading ? t('panel.refreshing') : t('panel.refresh')}
          </button>
        </div>
      </div>
    </motion.section>
  );
};