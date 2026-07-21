import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';
import { useTokenStore } from '../store/tokenStore';

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

export const TokenBall = ({ onOpen }: TokenBallProps) => {
  const percentage = useTokenStore((state) => state.percentage);
  const pointerState = useRef<PointerState | null>(null);
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const dashOffset = circumference * (1 - safePercentage / 100);

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
      aria-label={`Token balance ${safePercentage}% remaining`}
      className="relative flex h-20 w-20 touch-none items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-white shadow-2xl shadow-indigo-950/40 backdrop-blur-xl"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      whileTap={{ scale: 1.1 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
          stroke="#818cf8"
          strokeLinecap="round"
          strokeWidth="4"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <span className="relative inline-flex h-7 min-w-12 items-center justify-center overflow-hidden text-xl font-semibold tracking-tight">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={safePercentage}
              className="absolute"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {safePercentage}%
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="mt-1 text-[9px] font-medium tracking-[0.22em] text-slate-300">TOKEN</span>
      </span>
    </motion.button>
  );
};
