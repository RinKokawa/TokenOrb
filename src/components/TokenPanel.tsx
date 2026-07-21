import { motion } from 'framer-motion';
import { useTokenStore } from '../store/tokenStore';

type TokenPanelProps = {
  onClose: () => void;
  onHide: () => void;
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

const statusMap: Record<
  ReturnType<typeof useTokenStore.getState>['status'],
  { label: string; dot: string }
> = {
  idle: { label: 'Idle', dot: 'bg-slate-400' },
  loading: { label: 'Loading', dot: 'bg-amber-300' },
  online: { label: 'API Online', dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' },
  mock: { label: 'Mock Data', dot: 'bg-indigo-300' },
  unauthorized: { label: 'Token Invalid', dot: 'bg-rose-400' },
  offline: { label: 'Offline', dot: 'bg-amber-500' },
};

export const TokenPanel = ({ onClose, onHide, onRefresh, onSettings }: TokenPanelProps) => {
  const { snapshot, percentage, total, isLoading, lastFetchedAt, status, error } = useTokenStore();
  const statusInfo = statusMap[status];
  const primary = snapshot?.primary ?? null;
  const usedNumeric = Math.max(0, total - percentage);
  const weeklyUsed = primary?.weeklyUsedPercent ?? 0;

  return (
    <motion.section
      className="glass-panel flex h-[400px] w-[320px] flex-col overflow-hidden rounded-2xl p-5 text-slate-200"
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300">
            Token Monitor
          </p>
          <h1 className="light-text mt-1 text-xl font-semibold tracking-tight">Usage overview</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            onClick={onSettings}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          <button
            type="button"
            aria-label="Close panel"
            title="Collapse"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-500/15">
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
              stroke="#818cf8"
              strokeLinecap="round"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 25}
              animate={{ strokeDashoffset: 2 * Math.PI * 25 * (1 - percentage / 100) }}
            />
          </svg>
          <span className="light-text text-sm font-semibold">{percentage}%</span>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Remaining balance</p>
          <p className="light-text mt-1 text-2xl font-semibold tracking-tight">
            {formatNumber(percentage)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            of {formatNumber(total)}% · model {primary?.model ?? '—'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[var(--muted)]">Used (5h)</p>
          <p className="light-text mt-2 text-lg font-semibold">{formatNumber(usedNumeric)}%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[var(--muted)]">Weekly used</p>
          <p className="light-text mt-2 text-lg font-semibold">{formatNumber(weeklyUsed)}%</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">Last fetched</span>
          <span className="light-text font-medium">{formatTimestamp(lastFetchedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[var(--muted)]">Source</span>
          <span className="light-text font-medium">{snapshot?.baseUrl ?? '—'}</span>
        </div>
        {error ? <p className="mt-2 text-rose-300">{error}</p> : null}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
          <span className="text-xs font-medium text-[var(--muted)]">{statusInfo.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:bg-white/10 hover:text-white"
            onClick={onHide}
          >
            Hide
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={onRefresh}
          >
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>
    </motion.section>
  );
};
