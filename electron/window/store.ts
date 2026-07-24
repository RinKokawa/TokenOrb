import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  POSITION_FILE_NAME,
  parsePersistedPositionFile,
  serializePersistedPositionFile,
  type PersistedPosition,
} from './persistence';

const resolvePositionPath = (): string => path.join(app.getPath('userData'), POSITION_FILE_NAME);

export const loadPersistedPositionFromDisk = (): PersistedPosition | null => {
  const filePath = resolvePositionPath();
  let rawText: string;
  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    return null;
  }
  return parsePersistedPositionFile(rawText);
};

export const writePersistedPositionToDisk = (position: PersistedPosition): void => {
  const filePath = resolvePositionPath();
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, serializePersistedPositionFile(position), {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(tmpPath, filePath);
};
