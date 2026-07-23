import { ipcMain } from 'electron';
import {
  buildConfigStatus,
  createEmptyPersistedConfig,
  mergeConfigUpdate,
  validateConfigSaveInput,
  type ConfigSaveInput,
  type PersistedConfig,
  type SecretUpdate,
} from '../config/persistence';
import {
  decryptPersistedConfig,
  encryptSecret,
  isSafeStorageAvailable,
  loadPersistedConfigFromDisk,
  writePersistedConfigToDisk,
} from '../config/store';
import { setRuntimeConfig } from './token';
import type { RuntimeConfig } from '../config';
import type { ConfigSaveResult, PublicConfigStatus } from '../shared/token';

let persistedConfig: PersistedConfig = createEmptyPersistedConfig();
let storageAvailable = false;
let bootstrapped = false;

const STORAGE_UNAVAILABLE_USER_MESSAGE =
  'OS-level encrypted storage is unavailable. ' +
  'Credentials cannot be saved securely. Please enable macOS Keychain, ' +
  'Windows Credential Vault, or Linux Secret Service and try again.';

const buildRuntimeConfigFromPersisted = (
  config: PersistedConfig,
  available: boolean,
): RuntimeConfig => {
  const decrypted = decryptPersistedConfig(config);
  return {
    baseUrl: config.baseUrl,
    groupId: config.groupId,
    token: decrypted.token,
    cookieOverride: decrypted.cookieOverride,
    storageAvailable: available,
  };
};

export const bootstrapConfig = (): void => {
  if (bootstrapped) return;
  const loaded = loadPersistedConfigFromDisk();
  persistedConfig = loaded.config;
  storageAvailable = loaded.storageAvailable;
  bootstrapped = true;
};

export const getPersistedConfigSnapshot = (): PersistedConfig => persistedConfig;

const applySecretUpdate = (
  cipher: string | null,
  update: SecretUpdate,
): { ok: true; cipher: string | null } | { ok: false; error: string } => {
  if (update.kind === 'keep') return { ok: true, cipher };

  if (update.kind === 'clear') {
    return { ok: true, cipher: null };
  }

  if (update.value === null) {
    return { ok: true, cipher: null };
  }

  const encrypted = encryptSecret(update.value);
  if (typeof encrypted === 'object' && encrypted !== null && 'type' in encrypted) {
    return { ok: false, error: STORAGE_UNAVAILABLE_USER_MESSAGE };
  }

  return { ok: true, cipher: encrypted as string };
};

export const getConfigStatus = (): PublicConfigStatus =>
  buildConfigStatus(persistedConfig, storageAvailable && isSafeStorageAvailable());

export const saveConfig = (rawInput: unknown): ConfigSaveResult => {
  let input: ConfigSaveInput;
  try {
    input = validateConfigSaveInput(rawInput);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid config payload';
    return { ok: false, error: message };
  }

  const tokenResult = applySecretUpdate(persistedConfig.tokenCipher, input.token);
  if (!tokenResult.ok) return tokenResult;

  const cookieResult = applySecretUpdate(persistedConfig.cookieCipher, input.cookieOverride);
  if (!cookieResult.ok) return cookieResult;

  const next: PersistedConfig = mergeConfigUpdate(persistedConfig, {
    baseUrl: input.baseUrl,
    groupId: input.groupId,
    token: { kind: 'replace', value: tokenResult.cipher },
    cookieOverride: { kind: 'replace', value: cookieResult.cipher },
  });

  try {
    writePersistedConfigToDisk(next);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to write config file';
    return { ok: false, error: `Could not persist config: ${message}` };
  }

  persistedConfig = next;
  storageAvailable = isSafeStorageAvailable();

  const runtime = buildRuntimeConfigFromPersisted(next, storageAvailable);
  setRuntimeConfig(runtime);

  return { ok: true, status: buildConfigStatus(next, storageAvailable) };
};

export const registerConfigIpc = (): void => {
  ipcMain.handle('config:get', () => getConfigStatus());

  ipcMain.handle('config:save', (_event, value: unknown) => saveConfig(value));
};
