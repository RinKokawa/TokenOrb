import dotenv from 'dotenv';
import path from 'node:path';
import { app } from 'electron';
import {
  CONFIG_DEFAULT_BASE_URL,
  type PersistedConfig,
} from './config/persistence';
import {
  decryptPersistedConfig,
  isSafeStorageAvailable,
  loadPersistedConfigFromDisk,
} from './config/store';

const envPath = path.join(__dirname, '../.env');

dotenv.config({ path: envPath, override: false });

export type RuntimeConfig = {
  baseUrl: string;
  token: string | null;
  groupId: string | null;
  cookieOverride: string | null;
  storageAvailable: boolean;
};

const readEnvValue = (key: string): string | null => {
  const value = process.env[key];
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

let cachedEnvConfig: Pick<RuntimeConfig, 'baseUrl' | 'token' | 'groupId' | 'cookieOverride'> | null = null;

const loadEnvFallback = (): Pick<RuntimeConfig, 'baseUrl' | 'token' | 'groupId' | 'cookieOverride'> => {
  if (cachedEnvConfig) return cachedEnvConfig;
  if (app.isPackaged) {
    dotenv.config({ path: path.join(process.resourcesPath, '.env'), override: false });
  }
  cachedEnvConfig = {
    baseUrl: readEnvValue('MINIMAX_BASE_URL') ?? CONFIG_DEFAULT_BASE_URL,
    token: readEnvValue('MINIMAX_TOKEN'),
    groupId: readEnvValue('MINIMAX_GROUP_ID'),
    cookieOverride: readEnvValue('MINIMAX_COOKIE'),
  };
  return cachedEnvConfig;
};

const fromPersisted = (persisted: PersistedConfig, storageAvailable: boolean): RuntimeConfig => {
  const decrypted = decryptPersistedConfig(persisted);
  return {
    baseUrl: persisted.baseUrl,
    token: decrypted.token,
    groupId: persisted.groupId,
    cookieOverride: decrypted.cookieOverride,
    storageAvailable,
  };
};

const mergeWithEnvFallback = (
  fromPersistedConfig: RuntimeConfig,
  env: Pick<RuntimeConfig, 'baseUrl' | 'token' | 'groupId' | 'cookieOverride'>,
): RuntimeConfig => {
  const envHasUrl = !!readEnvValue('MINIMAX_BASE_URL');
  return {
    baseUrl: envHasUrl ? env.baseUrl : fromPersistedConfig.baseUrl,
    token: fromPersistedConfig.token ?? env.token,
    groupId: fromPersistedConfig.groupId ?? env.groupId,
    cookieOverride: fromPersistedConfig.cookieOverride ?? env.cookieOverride,
    storageAvailable: fromPersistedConfig.storageAvailable,
  };
};

export const loadRuntimeConfig = (): RuntimeConfig => {
  const env = loadEnvFallback();
  const loaded = loadPersistedConfigFromDisk();
  return mergeWithEnvFallback(fromPersisted(loaded.config, loaded.storageAvailable), env);
};

export const loadPersistedRuntimeConfig = (): RuntimeConfig => {
  const env = loadEnvFallback();
  const loaded = loadPersistedConfigFromDisk();
  const fromPersistedConfig = fromPersisted(loaded.config, loaded.storageAvailable);

  const envHasUrl = !!readEnvValue('MINIMAX_BASE_URL');
  return {
    baseUrl: envHasUrl ? env.baseUrl : fromPersistedConfig.baseUrl,
    token: fromPersistedConfig.token ?? env.token,
    groupId: fromPersistedConfig.groupId ?? env.groupId,
    cookieOverride: fromPersistedConfig.cookieOverride ?? env.cookieOverride,
    storageAvailable: isSafeStorageAvailable(),
  };
};
