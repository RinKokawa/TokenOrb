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
  return `${hours}:${minutes}`;
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          <AnimatePresence initial={false} mode="wait">
            {isHovered && nextRefreshAt && remainingMs !== null ? (
              <motion.span
                key="refresh-info"
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <span className="font-mono text-base font-semibold text-white">
                  {formatNextRefreshClock(nextRefreshAt)}
                </span>
                <span className="mt-0.5 font-mono text-[10px] font-medium text-indigo-300">
                  -{formatCountdown(remainingMs)}
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="balance"
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
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
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.div>
    </motion.button>
  );
};
