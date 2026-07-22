import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { getBalanceStroke, getBalanceTextClass } from '../lib/balanceColor';
import { useT } from '../i18n';

type TokenBallProps = {
  onOpen: () => void;
};

type PointerState = {
  x: number;
  y: number;
  moved: boolean;
};

const radius = 32;
const circumference = 2 * Math.PI * radius;

const formatNextRefreshClock = (timestamp: number | null): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const TokenBall = ({ onOpen }: TokenBallProps) => {
  const percentage = useTokenStore((state) => state.percentage);
  const nextRefreshAt = useTokenStore((state) => state.nextRefreshAt);
  const t = useT();
  const pointerState = useRef<PointerState | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const dashOffset = circumference * (1 - safePercentage / 100);
  const ringColor = getBalanceStroke(safePercentage);
  const textColor = getBalanceTextClass(safePercentage);

  useEffect(() => {
    if (!isHovered) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isHovered]);

  const remainingMs = nextRefreshAt ? Math.max(0, nextRefreshAt - now) : null;

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = { x: event.screenX, y: event.screenY, moved: false };
    window.electronAPI?.beginWindowDrag();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!pointerState.current) return;

    const distance = Math.hypot(
      event.screenX - pointerState.current.x,
      event.screenY - pointerState.current.y,
    );
    if (distance > 5) pointerState.current.moved = true;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const wasDragged = pointerState.current?.moved ?? false;
    pointerState.current = null;
    window.electronAPI?.endWindowDrag();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!wasDragged) onOpen();
  };

  return (
    <motion.button
      type="button"
      aria-label={t('ball.aria', { pct: safePercentage })}
      className="relative flex h-24 w-24 touch-none appearance-none items-center justify-center border-none bg-transparent p-0 outline-none focus:outline-none"
      whileTap={{ scale: 1.05 }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <motion.div
        className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-white backdrop-blur-xl"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      >
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 80 80"
          aria-hidden="true"
        >
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4"
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeLinecap="round"
            strokeWidth="4"
            strokeDasharray={circumference}
            animate={{ stroke: ringColor, strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <span className="relative flex flex-col items-center leading-none">
          <span className="relative inline-flex h-7 min-w-12 items-center justify-center overflow-hidden text-xl font-semibold tracking-tight">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={safePercentage}
                className={`absolute ${textColor}`}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {safePercentage}%
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="mt-1 text-[9px] font-medium tracking-[0.22em] text-slate-300">
            {t('ball.label')}
          </span>
        </span>
      </motion.div>
      <AnimatePresence>
        {isHovered && nextRefreshAt && remainingMs !== null ? (
          <motion.div
            key="refresh-tooltip"
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-[11px] leading-relaxed text-slate-200 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)]">{t('ball.tooltip.nextAt')}</span>
              <span className="font-mono font-medium text-white">
                {formatNextRefreshClock(nextRefreshAt)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[var(--muted)]">{t('ball.tooltip.countdown')}</span>
              <span className="font-mono font-medium text-indigo-300">
                {formatCountdown(remainingMs)}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
};
