export type BalanceLevel = 'full' | 'mid' | 'low';

const FULL_THRESHOLD = 50;
const LOW_THRESHOLD = 10;

export const classifyBalance = (percentage: number): BalanceLevel => {
  if (percentage >= FULL_THRESHOLD) return 'full';
  if (percentage >= LOW_THRESHOLD) return 'mid';
  return 'low';
};

export const getBalanceStroke = (percentage: number): string => {
  switch (classifyBalance(percentage)) {
    case 'full':
      return '#34d399';
    case 'low':
      return '#f87171';
    case 'mid':
    default:
      return '#818cf8';
  }
};

export const getBalanceTextClass = (percentage: number): string => {
  switch (classifyBalance(percentage)) {
    case 'full':
      return 'text-emerald-300';
    case 'low':
      return 'text-rose-300';
    case 'mid':
    default:
      return 'text-indigo-300';
  }
};

export const getBalanceRingBgClass = (percentage: number): string => {
  switch (classifyBalance(percentage)) {
    case 'full':
      return 'bg-emerald-500/15';
    case 'low':
      return 'bg-rose-500/15';
    case 'mid':
    default:
      return 'bg-indigo-500/15';
  }
};