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
      return 'var(--balance-full)';
    case 'low':
      return 'var(--balance-low)';
    case 'mid':
    default:
      return 'var(--balance-mid)';
  }
};

export const getBalanceTextClass = (percentage: number): string => {
  switch (classifyBalance(percentage)) {
    case 'full':
      return 'balance-text-full';
    case 'low':
      return 'balance-text-low';
    case 'mid':
    default:
      return 'balance-text-mid';
  }
};

export const getBalanceRingBgClass = (percentage: number): string => {
  switch (classifyBalance(percentage)) {
    case 'full':
      return 'balance-surface-full';
    case 'low':
      return 'balance-surface-low';
    case 'mid':
    default:
      return 'balance-surface-mid';
  }
};
