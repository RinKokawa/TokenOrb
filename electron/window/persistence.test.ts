import { describe, expect, it } from 'vitest';
import {
  POSITION_FILE_NAME,
  POSITION_SCHEMA_VERSION,
  isValidPersistedPosition,
  parsePersistedPositionFile,
  resolveRestoredPosition,
  serializePersistedPositionFile,
  type DisplayInfo,
  type PersistedPosition,
} from './persistence';

describe('POSITION_FILE_NAME', () => {
  it('uses the expected file name', () => {
    expect(POSITION_FILE_NAME).toBe('window-position.json');
  });
});

describe('isValidPersistedPosition', () => {
  const valid: PersistedPosition = { schemaVersion: 1, x: 100, y: 200, displayId: 12345 };

  it('accepts a well-formed payload', () => {
    expect(isValidPersistedPosition(valid)).toBe(true);
  });

  it('accepts negative coordinates', () => {
    expect(isValidPersistedPosition({ ...valid, x: -1500, y: -200 })).toBe(true);
  });

  it('rejects non-numeric x or y', () => {
    expect(isValidPersistedPosition({ ...valid, x: '100' })).toBe(false);
    expect(isValidPersistedPosition({ ...valid, y: null })).toBe(false);
  });

  it('rejects non-numeric displayId', () => {
    expect(isValidPersistedPosition({ ...valid, displayId: '12345' })).toBe(false);
  });

  it('rejects NaN or Infinity coordinates', () => {
    expect(isValidPersistedPosition({ ...valid, x: Number.NaN })).toBe(false);
    expect(isValidPersistedPosition({ ...valid, y: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isValidPersistedPosition({ ...valid, displayId: Number.NEGATIVE_INFINITY })).toBe(false);
  });

  it('rejects null and non-objects', () => {
    expect(isValidPersistedPosition(null)).toBe(false);
    expect(isValidPersistedPosition('payload')).toBe(false);
    expect(isValidPersistedPosition(undefined)).toBe(false);
    expect(isValidPersistedPosition([1, 2, 3])).toBe(false);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(isValidPersistedPosition({ ...valid, schemaVersion: 2 })).toBe(false);
    expect(isValidPersistedPosition({ ...valid, schemaVersion: 0 })).toBe(false);
  });

  it('rejects missing fields', () => {
    const base = { schemaVersion: POSITION_SCHEMA_VERSION, x: 1, y: 1, displayId: 1 };
    expect(isValidPersistedPosition({ ...base, x: undefined })).toBe(false);
    expect(isValidPersistedPosition({ ...base, y: undefined })).toBe(false);
    expect(isValidPersistedPosition({ ...base, displayId: undefined })).toBe(false);
  });
});

describe('parsePersistedPositionFile', () => {
  it('returns null when rawText is null', () => {
    expect(parsePersistedPositionFile(null)).toBeNull();
  });

  it('returns null when JSON is invalid', () => {
    expect(parsePersistedPositionFile('not-json')).toBeNull();
  });

  it('returns the parsed payload when valid', () => {
    const raw = JSON.stringify({
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: 10,
      y: 20,
      displayId: 99,
    });
    expect(parsePersistedPositionFile(raw)).toEqual({
      schemaVersion: 1,
      x: 10,
      y: 20,
      displayId: 99,
    });
  });

  it('returns null when x or y are missing', () => {
    const raw = JSON.stringify({ schemaVersion: 1, y: 1, displayId: 1 });
    expect(parsePersistedPositionFile(raw)).toBeNull();
  });

  it('returns null for unsupported schemaVersion', () => {
    const raw = JSON.stringify({ schemaVersion: 2, x: 1, y: 1, displayId: 1 });
    expect(parsePersistedPositionFile(raw)).toBeNull();
  });
});

describe('serializePersistedPositionFile', () => {
  it('produces deterministic JSON with the expected schema', () => {
    const text = serializePersistedPositionFile({
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: 10,
      y: 20,
      displayId: 99,
    });
    expect(JSON.parse(text)).toEqual({
      schemaVersion: 1,
      x: 10,
      y: 20,
      displayId: 99,
    });
  });

  it('round-trips through parsePersistedPositionFile', () => {
    const original: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: -1500,
      y: 240,
      displayId: 7,
    };
    expect(parsePersistedPositionFile(serializePersistedPositionFile(original))).toEqual(original);
  });
});

describe('resolveRestoredPosition', () => {
  const size = { width: 96, height: 96 };
  const fallback = { x: 1824, y: 984, displayId: 1 };
  const displays: DisplayInfo[] = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, workArea: { x: -1920, y: 0, width: 1920, height: 1080 } },
  ];

  it('returns the saved position when inside the matching display', () => {
    const saved: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: 500,
      y: 200,
      displayId: 1,
    };
    expect(resolveRestoredPosition(saved, displays, size, fallback)).toEqual({
      x: 500,
      y: 200,
      displayId: 1,
    });
  });

  it('clamps coordinates that overflow the matching display', () => {
    const saved: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: 1900,
      y: 200,
      displayId: 1,
    };
    expect(resolveRestoredPosition(saved, displays, size, fallback)).toEqual({
      x: 1824,
      y: 200,
      displayId: 1,
    });
  });

  it('keeps negative coordinates on a negative-origin display', () => {
    const saved: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: -1500,
      y: 200,
      displayId: 2,
    };
    expect(resolveRestoredPosition(saved, displays, size, fallback)).toEqual({
      x: -1500,
      y: 200,
      displayId: 2,
    });
  });

  it('clamps negative coordinates that overshoot the negative-origin display', () => {
    const saved: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: -2500,
      y: 200,
      displayId: 2,
    };
    expect(resolveRestoredPosition(saved, displays, size, fallback)).toEqual({
      x: -1920,
      y: 200,
      displayId: 2,
    });
  });

  it('falls back when the saved displayId is not connected', () => {
    const saved: PersistedPosition = {
      schemaVersion: POSITION_SCHEMA_VERSION,
      x: 100,
      y: 100,
      displayId: 999,
    };
    expect(resolveRestoredPosition(saved, displays, size, fallback)).toEqual(fallback);
  });

  it('falls back when given null', () => {
    expect(resolveRestoredPosition(null, displays, size, fallback)).toEqual(fallback);
  });

  it('falls back when the displays list is empty', () => {
    expect(resolveRestoredPosition(null, [], size, fallback)).toEqual(fallback);
  });
});