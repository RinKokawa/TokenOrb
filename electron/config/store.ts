import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_FILE_NAME,
  CONFIG_DEFAULT_BASE_URL,
  createEmptyPersistedConfig,
  parseConfigFile,
  serializeConfigFile,
  type PersistedConfig,
} from './persistence';

export type LoadedPersistedConfig = {
  config: PersistedConfig;
  storageAvailable: boolean;
  source: 'file' | 'missing' | 'unreadable';
};

export type SafeStorageFailure = {
  type: 'storage-unavailable';
  message: string;
};

const resolveConfigPath = (): string => path.join(app.getPath('userData'), CONFIG_FILE_NAME);

export const isSafeStorageAvailable = (): boolean => safeStorage.isEncryptionAvailable();

export const loadPersistedConfigFromDisk = (): LoadedPersistedConfig => {
  const filePath = resolveConfigPath();
  let rawText: string | null = null;

  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        config: createEmptyPersistedConfig(),
        storageAvailable: isSafeStorageAvailable(),
        source: 'missing',
      };
    }
    return {
      config: createEmptyPersistedConfig(),
      storageAvailable: isSafeStorageAvailable(),
      source: 'unreadable',
    };
  }

  const parsed = parseConfigFile(rawText);
  if (!parsed) {
    return {
      config: createEmptyPersistedConfig(),
      storageAvailable: isSafeStorageAvailable(),
      source: 'unreadable',
    };
  }

  return { config: parsed, storageAvailable: isSafeStorageAvailable(), source: 'file' };
};

export const writePersistedConfigToDisk = (config: PersistedConfig): void => {
  const filePath = resolveConfigPath();
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, serializeConfigFile(config), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
};

export const encryptSecret = (plaintext: string | null): string | SafeStorageFailure => {
  if (plaintext === null) return null as unknown as string;
  if (!isSafeStorageAvailable()) {
    return {
      type: 'storage-unavailable',
      message:
        'OS-level encrypted storage is not available on this system. ' +
        'Refusing to persist the credential as plaintext.',
    };
  }
  try {
    const encrypted = safeStorage.encryptString(plaintext);
    return encrypted.toString('base64');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'safeStorage.encryptString failed';
    return { type: 'storage-unavailable', message };
  }
};

export const decryptSecret = (cipher: string | null): string | null => {
  if (cipher === null) return null;
  if (!isSafeStorageAvailable()) return null;
  try {
    const buffer = Buffer.from(cipher, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return null;
  }
};

export const decryptPersistedConfig = (
  config: PersistedConfig,
): {
  baseUrl: string;
  groupId: string | null;
  token: string | null;
  cookieOverride: string | null;
} => ({
  baseUrl: config.baseUrl,
  groupId: config.groupId,
  token: decryptSecret(config.tokenCipher),
  cookieOverride: decryptSecret(config.cookieCipher),
});

export const CONFIG_PERSISTENCE_DEFAULTS = {
  defaultBaseUrl: CONFIG_DEFAULT_BASE_URL,
  configFileName: CONFIG_FILE_NAME,
};
