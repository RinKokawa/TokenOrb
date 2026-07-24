import { describe, expect, it } from 'vitest';
import {
  buildConfigStatus,
  mergeConfigUpdate,
  normalizeBaseUrl,
  parseConfigFile,
  serializeConfigFile,
  type PersistedConfig,
  type PublicConfigStatus,
  type SecretUpdate,
} from './persistence';

const baseConfig = (): PersistedConfig => ({
  schemaVersion: 1,
  baseUrl: 'https://www.minimaxi.com',
  groupId: null,
  tokenCipher: null,
  cookieCipher: null,
});

const replace = (value: string | null): SecretUpdate => ({ kind: 'replace', value });

describe('parseConfigFile', () => {
  it('returns null when there is no saved config', () => {
    expect(parseConfigFile(null)).toBeNull();
  });

  it('parses a well-formed config file', () => {
    const serialized = serializeConfigFile({
      schemaVersion: 1,
      baseUrl: 'https://www.minimaxi.com',
      groupId: '2013606000870826167',
      tokenCipher: 'base64blob',
      cookieCipher: null,
    });

    expect(parseConfigFile(serialized)).toEqual({
      schemaVersion: 1,
      baseUrl: 'https://www.minimaxi.com',
      groupId: '2013606000870826167',
      tokenCipher: 'base64blob',
      cookieCipher: null,
    });
  });

  it('returns null when JSON is invalid', () => {
    expect(parseConfigFile('not-json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseConfigFile(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
  });

  it('returns null when schemaVersion is unsupported', () => {
    const raw = JSON.stringify({
      schemaVersion: 2,
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      tokenCipher: null,
      cookieCipher: null,
    });
    expect(parseConfigFile(raw)).toBeNull();
  });

  it('coerces non-string baseUrl to null status when invalid', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      baseUrl: 42,
      groupId: null,
      tokenCipher: null,
      cookieCipher: null,
    });
    expect(parseConfigFile(raw)).toBeNull();
  });
});

describe('serializeConfigFile', () => {
  it('produces deterministic JSON containing only the persisted schema', () => {
    const config: PersistedConfig = {
      schemaVersion: 1,
      baseUrl: 'https://www.minimaxi.com',
      groupId: '2013606000870826167',
      tokenCipher: 'blob-token',
      cookieCipher: 'blob-cookie',
    };

    const text = serializeConfigFile(config);
    const parsed = JSON.parse(text);

    expect(parsed).toEqual(config);
    expect(text).not.toContain('eyJ'); // never embeds plaintext JWT shapes
  });
});

describe('normalizeBaseUrl', () => {
  it.each([
    ['https://www.minimaxi.com/', 'https://www.minimaxi.com'],
    ['HTTPS://www.minimaxi.com', 'https://www.minimaxi.com'],
    ['http://localhost:3000/', 'http://localhost:3000'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it('falls back to default when input is empty or invalid', () => {
    expect(normalizeBaseUrl('')).toBe('https://www.minimaxi.com');
    expect(normalizeBaseUrl('not a url')).toBe('https://www.minimaxi.com');
    expect(normalizeBaseUrl(null)).toBe('https://www.minimaxi.com');
  });
});

describe('mergeConfigUpdate', () => {
  it('keeps the existing secret when token.kind === keep', () => {
    const previous = { ...baseConfig(), tokenCipher: 'opaque-ciphertext' } as PersistedConfig;
    const update = {
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      token: { kind: 'keep' } as SecretUpdate,
      cookieOverride: { kind: 'keep' } as SecretUpdate,
    };

    const merged = mergeConfigUpdate(previous, update);
    expect(merged.tokenCipher).toBe('opaque-ciphertext');
    expect(merged.cookieCipher).toBeNull();
  });

  it('replaces the secret when token.kind === replace with a value', () => {
    const previous = { ...baseConfig(), tokenCipher: 'opaque-ciphertext' } as PersistedConfig;
    const update = {
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      token: replace('new-cipher'),
      cookieOverride: { kind: 'keep' } as SecretUpdate,
    };

    const merged = mergeConfigUpdate(previous, update);
    expect(merged.tokenCipher).toBe('new-cipher');
  });

  it('clears the secret when token.kind === clear', () => {
    const previous = { ...baseConfig(), tokenCipher: 'opaque-ciphertext' } as PersistedConfig;
    const update = {
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      token: { kind: 'clear' } as SecretUpdate,
      cookieOverride: { kind: 'clear' } as SecretUpdate,
    };

    const merged = mergeConfigUpdate(previous, update);
    expect(merged.tokenCipher).toBeNull();
    expect(merged.cookieCipher).toBeNull();
  });

  it('clears the secret when token.kind === replace with null', () => {
    const previous = { ...baseConfig(), cookieCipher: 'opaque' } as PersistedConfig;
    const update = {
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      token: replace(null),
      cookieOverride: { kind: 'keep' } as SecretUpdate,
    };

    const merged = mergeConfigUpdate(previous, update);
    expect(merged.tokenCipher).toBeNull();
    expect(merged.cookieCipher).toBe('opaque');
  });

  it('updates baseUrl and groupId while keeping secrets unchanged', () => {
    const previous = { ...baseConfig(), tokenCipher: 'opaque' } as PersistedConfig;
    const update = {
      baseUrl: 'https://override.example.com',
      groupId: 'new-group',
      token: { kind: 'keep' } as SecretUpdate,
      cookieOverride: { kind: 'keep' } as SecretUpdate,
    };

    const merged = mergeConfigUpdate(previous, update);
    expect(merged.baseUrl).toBe('https://override.example.com');
    expect(merged.groupId).toBe('new-group');
    expect(merged.tokenCipher).toBe('opaque');
  });

  it('preserves schemaVersion', () => {
    const previous = { ...baseConfig() } as PersistedConfig;
    const merged = mergeConfigUpdate(previous, {
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      token: { kind: 'keep' } as SecretUpdate,
      cookieOverride: { kind: 'keep' } as SecretUpdate,
    });
    expect(merged.schemaVersion).toBe(1);
  });
});

describe('buildConfigStatus', () => {
  it('only exposes public fields, never the ciphertext', () => {
    const config: PersistedConfig = {
      schemaVersion: 1,
      baseUrl: 'https://www.minimaxi.com',
      groupId: '2013606000870826167',
      tokenCipher: 'super-secret-ciphertext',
      cookieCipher: 'cookie-cipher',
    };

    const status: PublicConfigStatus = buildConfigStatus(config, true);
    const keys = Object.keys(status).sort();

    expect(keys).toEqual([
      'baseUrl',
      'cookieConfigured',
      'groupId',
      'storageAvailable',
      'tokenConfigured',
    ]);
    expect(status).toEqual({
      baseUrl: 'https://www.minimaxi.com',
      groupId: '2013606000870826167',
      tokenConfigured: true,
      cookieConfigured: true,
      storageAvailable: true,
    });
    expect(JSON.stringify(status)).not.toContain('ciphertext');
  });

  it('reports storageAvailable=false and absence of secrets', () => {
    const config = baseConfig();
    const status = buildConfigStatus(config, false);
    expect(status).toEqual({
      baseUrl: 'https://www.minimaxi.com',
      groupId: null,
      tokenConfigured: false,
      cookieConfigured: false,
      storageAvailable: false,
    });
  });

  it('serializes cleanly through JSON.stringify', () => {
    const status = buildConfigStatus(
      {
        schemaVersion: 1,
        baseUrl: 'https://www.minimaxi.com',
        groupId: null,
        tokenCipher: 'NOPE',
        cookieCipher: 'NOPE',
      },
      true,
    );

    const text = JSON.stringify(status);
    expect(text).not.toContain('NOPE');
    expect(text).not.toContain('cipher');
  });
});
