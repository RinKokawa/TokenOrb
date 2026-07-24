export const POSITION_SCHEMA_VERSION = 1 as const;
export const POSITION_FILE_NAME = 'window-position.json';

export type PersistedPosition = {
  schemaVersion: typeof POSITION_SCHEMA_VERSION;
  x: number;
  y: number;
  displayId: number;
};

export type DisplayInfo = {
  id: number;
  workArea: { x: number; y: number; width: number; height: number };
};

export type Size = { width: number; height: number };

export type RestoredPosition = { x: number; y: number; displayId: number };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isValidPersistedPosition = (value: unknown): value is PersistedPosition => {
  if (!isPlainObject(value)) return false;
  if (value.schemaVersion !== POSITION_SCHEMA_VERSION) return false;
  if (!isFiniteNumber(value.x)) return false;
  if (!isFiniteNumber(value.y)) return false;
  if (!isFiniteNumber(value.displayId)) return false;
  return true;
};

export const parsePersistedPositionFile = (rawText: string | null): PersistedPosition | null => {
  if (rawText === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  return isValidPersistedPosition(parsed) ? parsed : null;
};

export const serializePersistedPositionFile = (position: PersistedPosition): string =>
  JSON.stringify(position, null, 2);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampPointToWorkArea = (
  point: { x: number; y: number },
  size: Size,
  workArea: { x: number; y: number; width: number; height: number },
): { x: number; y: number } => ({
  x: clamp(point.x, workArea.x, workArea.x + workArea.width - size.width),
  y: clamp(point.y, workArea.y, workArea.y + workArea.height - size.height),
});

export const resolveRestoredPosition = (
  saved: PersistedPosition | null,
  displays: DisplayInfo[],
  size: Size,
  fallback: RestoredPosition,
): RestoredPosition => {
  if (!saved) return fallback;
  const display = displays.find((d) => d.id === saved.displayId);
  if (!display) return fallback;
  const clamped = clampPointToWorkArea({ x: saved.x, y: saved.y }, size, display.workArea);
  return { x: clamped.x, y: clamped.y, displayId: saved.displayId };
};
