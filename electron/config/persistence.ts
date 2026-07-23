export const CONFIG_SCHEMA_VERSION = 1 as const;
export const CONFIG_FILE_NAME = 'minimax-config.json';
export const CONFIG_DEFAULT_BASE_URL = 'https://www.minimaxi.com';

export type PersistedConfig = {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  baseUrl: string;
  groupId: string | null;
  tokenCipher: string | null;
  cookieCipher: string | null;
};

export type SecretUpdate =
  | { kind: 'keep' }
  | { kind: 'replace'; value: string | null }
  | { kind: 'clear' };

export type ConfigSaveInput = {
  baseUrl: string;
  groupId: string | null;
  token: SecretUpdate;
  cookieOverride: SecretUpdate;
};

export type PublicConfigStatus = {
  baseUrl: string;
  groupId: string | null;
  tokenConfigured: boolean;
  cookieConfigured: boolean;
  storageAvailable: boolean;
};

export type StorageUnavailableError = {
  type: 'storage-unavailable';
  message: string;
};

export class ConfigValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid config payload: ${issues.join('; ')}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

const trimOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parsePersistedConfigShape = (raw: unknown): PersistedConfig | null => {
  if (!isPlainObject(raw)) return null;

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== CONFIG_SCHEMA_VERSION) return null;

  const baseUrl = raw.baseUrl;
  if (typeof baseUrl !== 'string') return null;

  const groupId = trimOrNull(raw.groupId);

  const tokenCipher = trimOrNull(raw.tokenCipher);
  const cookieCipher = trimOrNull(raw.cookieCipher);

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    baseUrl,
    groupId,
    tokenCipher,
    cookieCipher,
  };
};

export const parseConfigFile = (rawText: string | null): PersistedConfig | null => {
  if (rawText === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  return parsePersistedConfigShape(parsed);
};

export const serializeConfigFile = (config: PersistedConfig): string => {
  const payload: PersistedConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    baseUrl: config.baseUrl,
    groupId: config.groupId,
    tokenCipher: config.tokenCipher,
    cookieCipher: config.cookieCipher,
  };
  return JSON.stringify(payload, null, 2);
};

export const createEmptyPersistedConfig = (
  baseUrl: string = CONFIG_DEFAULT_BASE_URL,
): PersistedConfig => ({
  schemaVersion: CONFIG_SCHEMA_VERSION,
  baseUrl,
  groupId: null,
  tokenCipher: null,
  cookieCipher: null,
});

export const normalizeBaseUrl = (input: string | null | undefined): string => {
  if (typeof input !== 'string') return CONFIG_DEFAULT_BASE_URL;
  const trimmed = input.trim();
  if (trimmed.length === 0) return CONFIG_DEFAULT_BASE_URL;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return CONFIG_DEFAULT_BASE_URL;
    }
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return CONFIG_DEFAULT_BASE_URL;
  }
};

const validateGroupId = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ConfigValidationError(['groupId must be a string']);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 128) {
    throw new ConfigValidationError(['groupId is too long']);
  }
  if (!/^[A-Za-z0-9_.\-:]+$/.test(trimmed)) {
    throw new ConfigValidationError(['groupId contains invalid characters']);
  }
  return trimmed;
};

const validateSecret = (key: 'token' | 'cookieOverride', value: unknown): SecretUpdate => {
  if (!isPlainObject(value)) {
    throw new ConfigValidationError([`${key} must be an object with kind=keep|replace|clear`]);
  }
  const kind = value.kind;
  if (kind === 'keep' || kind === 'clear') return { kind };

  if (kind !== 'replace') {
    throw new ConfigValidationError([`${key}.kind must be keep, replace, or clear`]);
  }
  if (value.value === undefined || value.value === null) {
    return { kind: 'replace', value: null };
  }
  if (typeof value.value !== 'string') {
    throw new ConfigValidationError([`${key}.value must be a string when provided`]);
  }
  const trimmed = value.value.trim();
  if (trimmed.length === 0) return { kind: 'replace', value: null };
  if (trimmed.length > 8192) {
    throw new ConfigValidationError([`${key}.value is too long`]);
  }
  return { kind: 'replace', value: trimmed };
};

export const validateConfigSaveInput = (raw: unknown): ConfigSaveInput => {
  if (!isPlainObject(raw)) {
    throw new ConfigValidationError(['payload must be an object']);
  }

  const baseUrl = normalizeBaseUrl(typeof raw.baseUrl === 'string' ? raw.baseUrl : null);
  const groupId = validateGroupId(raw.groupId);
  const token = validateSecret('token', raw.token);
  const cookieOverride = validateSecret('cookieOverride', raw.cookieOverride);

  return { baseUrl, groupId, token, cookieOverride };
};

const isCipherString = (value: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

export const mergeConfigUpdate = (
  previous: PersistedConfig,
  update: ConfigSaveInput,
): PersistedConfig => {
  const nextTokenCipher =
    update.token.kind === 'keep'
      ? previous.tokenCipher
      : update.token.kind === 'clear'
        ? null
        : isCipherString(update.token.value)
          ? update.token.value
          : null;

  const nextCookieCipher =
    update.cookieOverride.kind === 'keep'
      ? previous.cookieCipher
      : update.cookieOverride.kind === 'clear'
        ? null
        : isCipherString(update.cookieOverride.value)
          ? update.cookieOverride.value
          : null;

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    baseUrl: update.baseUrl,
    groupId: update.groupId,
    tokenCipher: nextTokenCipher,
    cookieCipher: nextCookieCipher,
  };
};

export const buildConfigStatus = (
  config: PersistedConfig,
  storageAvailable: boolean,
): PublicConfigStatus => ({
  baseUrl: config.baseUrl,
  groupId: config.groupId,
  tokenConfigured: config.tokenCipher !== null,
  cookieConfigured: config.cookieCipher !== null,
  storageAvailable,
});
