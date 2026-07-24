import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
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

const formatNextRefreshClock = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const TokenBall = ({ onOpen }: TokenBallProps) => {
  const percentage = useTokenStore((state) => state.percentage);
  const quotaResetAt = useTokenStore((state) => state.quotaResetAt);
  const nextPollAt = useTokenStore((state) => state.nextPollAt);
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const pointerState = useRef<PointerState | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const dashOffset = circumference * (1 - safePercentage / 100);
  const ringColor = getBalanceStroke(safePercentage);
  const textColor = getBalanceTextClass(safePercentage);
  const hasClockInfo = quotaResetAt !== null || nextPollAt !== null;

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

  const clockContent = (
    <span className="flex flex-col items-center gap-0.5">
      {quotaResetAt ? (
        <span
          className="flex items-baseline gap-1 whitespace-nowrap"
          aria-label={t('ball.quotaResetAt', { time: formatNextRefreshClock(quotaResetAt) })}
        >
          <span className="text-[7px] font-medium uppercase tracking-wide text-slate-300">
            {t('ball.quotaResetShort')}
          </span>
          <span className="font-mono text-[10px] font-semibold text-white">
            {formatNextRefreshClock(quotaResetAt)}
          </span>
        </span>
      ) : null}
      {nextPollAt ? (
        <span
          className="flex items-baseline gap-1 whitespace-nowrap"
          aria-label={t('ball.nextPollAt', { time: formatNextRefreshClock(nextPollAt) })}
        >
          <span className="text-[7px] font-medium uppercase tracking-wide text-slate-300">
            {t('ball.nextPollShort')}
          </span>
          <span className="font-mono text-[10px] font-semibold text-white">
            {formatNextRefreshClock(nextPollAt)}
          </span>
        </span>
      ) : null}
    </span>
  );

  const staticBalanceContent = (
    <span className="flex flex-col items-center">
      <span
        className={`relative inline-flex h-7 min-w-12 items-center justify-center overflow-hidden text-xl font-semibold tracking-tight ${textColor}`}
      >
        {safePercentage}%
      </span>
      <span className="mt-1 text-[9px] font-medium tracking-[0.22em] text-slate-300">
        {t('ball.label')}
      </span>
    </span>
  );

  return (
    <motion.button
      type="button"
      aria-label={t('ball.aria', { pct: safePercentage })}
      className="relative flex h-24 w-24 touch-none appearance-none items-center justify-center border-none bg-transparent p-0 outline-none focus:outline-none"
      whileTap={shouldReduceMotion ? undefined : { scale: 1.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <motion.div
        className="token-ball relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-white backdrop-blur-xl"
        animate={shouldReduceMotion ? { y: 0 } : { y: [0, -3, 0] }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 4, ease: 'easeInOut', repeat: Infinity }
        }
      >
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 80 80"
          aria-hidden="true"
        >
          <circle
            className="balance-ring-track"
            cx="40"
            cy="40"
            r={radius}
            fill="none"
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
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <span className="relative flex flex-col items-center leading-none">
          {shouldReduceMotion ? (
            isHovered && hasClockInfo ? (
              clockContent
            ) : (
              staticBalanceContent
            )
          ) : (
            <AnimatePresence initial={false} mode="wait">
              {isHovered && hasClockInfo ? (
                <motion.span
                  key="refresh-info"
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {clockContent}
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
          )}
        </span>
      </motion.div>
    </motion.button>
  );
};
