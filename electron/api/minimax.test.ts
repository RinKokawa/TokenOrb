import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchTokenPlan,
  InvalidResponseError,
  InvalidTokenError,
  normalizeTimestamp,
} from './minimax';

const SAFE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.safe-token-value';
const SAFE_GROUP_ID = '1234567890123456789';

type FetchCall = { url: string; init: RequestInit };
let fetchCalls: FetchCall[] = [];

const installFetchMock = (
  responder: (url: string, init: RequestInit) => Promise<Response>,
): { restore: () => void } => {
  const originalFetch = globalThis.fetch;
  const stub = vi.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      fetchCalls.push({ url, init });
      return responder(url, init);
    },
  );
  globalThis.fetch = stub as unknown as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const textResponse = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html' },
  });

const OFFICIAL_BASE_URL = 'https://www.minimaxi.com';

describe('normalizeTimestamp', () => {
  it('converts Unix seconds to JavaScript milliseconds', () => {
    expect(normalizeTimestamp(1_750_000_000)).toBe(1_750_000_000_000);
  });

  it('preserves millisecond timestamps', () => {
    expect(normalizeTimestamp(1_750_000_000_000)).toBe(1_750_000_000_000);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1750000000', null])(
    'rejects invalid timestamp %s',
    (value) => {
      expect(normalizeTimestamp(value)).toBe(0);
    },
  );
});

describe('fetchTokenPlan URL validation', () => {
  let mock: { restore: () => void };

  beforeEach(() => {
    fetchCalls = [];
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 30,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000,
          },
        ],
      }),
    );
  });

  afterEach(() => {
    mock.restore();
  });

  it.each([
    ['https://attacker.example.com'],
    ['https://api.minimaxi.com'],
  ])('accepts custom HTTPS host %s', async (baseUrl) => {
    await fetchTokenPlan({
      baseUrl,
      token: SAFE_TOKEN,
      groupId: SAFE_GROUP_ID,
    });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url.startsWith(baseUrl)).toBe(true);
  });

  it.each([
    ['http://localhost:8080'],
    ['http://127.0.0.1:3000'],
    ['http://[::1]:8080'],
  ])('accepts HTTP loopback host %s', async (baseUrl) => {
    await fetchTokenPlan({
      baseUrl,
      token: SAFE_TOKEN,
      groupId: null,
    });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url.startsWith(baseUrl)).toBe(true);
  });

  it('rejects credentials embedded in the URL', async () => {
    await expect(
      fetchTokenPlan({
        baseUrl: 'https://user:pass@attacker.example.com',
        token: SAFE_TOKEN,
        groupId: null,
      }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });

  it.each([
    ['http://example.com'],
    ['http://10.0.0.5'],
    ['http://192.168.1.1'],
    ['http://attacker.example.com'],
  ])('rejects non-loopback HTTP %s', async (baseUrl) => {
    await expect(
      fetchTokenPlan({ baseUrl, token: SAFE_TOKEN, groupId: null }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });

  it.each([
    ['file:///etc/passwd'],
    ['ftp://example.com'],
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['ws://example.com'],
    ['wss://example.com'],
  ])('rejects non-http(s) scheme %s', async (baseUrl) => {
    await expect(
      fetchTokenPlan({ baseUrl, token: SAFE_TOKEN, groupId: null }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });

  it.each([
    [''],
    ['   '],
    ['not a url'],
    ['://missing-scheme'],
    ['https://'],
  ])('rejects malformed URL %s', async (baseUrl) => {
    await expect(
      fetchTokenPlan({ baseUrl, token: SAFE_TOKEN, groupId: null }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });

  it.each([
    ['https://example.com#fragment'],
    ['https://example.com/?leak=1'],
    ['https://attacker.example.com/?evil=1'],
  ])('rejects URL carrying query string or fragment %s', async (baseUrl) => {
    await expect(
      fetchTokenPlan({ baseUrl, token: SAFE_TOKEN, groupId: null }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });

  it('rejects base path that ends with a trailing slash or deeper path', async () => {
    await expect(
      fetchTokenPlan({
        baseUrl: 'https://example.com/some/other/path/',
        token: SAFE_TOKEN,
        groupId: null,
      }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
    expect(fetchCalls).toHaveLength(0);
  });
});

describe('fetchTokenPlan safe error messages', () => {
  const SECRET_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.REALSECRETTOKENVALUE123456789';
  const SECRET_GROUP_ID = '9999999999999999999';
  const SECRET_COOKIE = '_token=eyJhbGciOiJIUzI1NiJ9.SECRETCOOKIE123456789; minimax_group_id_v2=9999999999999999999';

  const assertSecretsLeaked = async (error: unknown): Promise<void> => {
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).not.toContain(SECRET_TOKEN);
    expect(message).not.toContain(SECRET_TOKEN.slice(0, 20));
    expect(message).not.toContain('SECRETCOOKIE123456789');
    expect(message).not.toContain(SECRET_GROUP_ID);
    expect(message).not.toMatch(/<html/i);
    expect(message).not.toMatch(/<script/i);
    expect(message).not.toContain('class=');
    expect(message).not.toContain('SET-COOKIE');
    expect(message).not.toContain('Set-Cookie');
    expect(message).not.toContain('cipher');
  };

  it('hides secrets when network request fails', async () => {
    const mock = installFetchMock(async () => {
      throw new TypeError('getaddrinfo ENOTFOUND evil.example.com token=eyJhbGciOiJIUzI1NiJ9.REALSECRETTOKENVALUE123456789');
    });

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: SECRET_GROUP_ID,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        await assertSecretsLeaked(error);
      }
    } finally {
      mock.restore();
    }
  });

  it('hides secrets when response body contains HTML', async () => {
    const mock = installFetchMock(async () =>
      textResponse(
        502,
        `<html><body>leak token=${SECRET_TOKEN} group=${SECRET_GROUP_ID}</body></html>`,
      ),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: SECRET_GROUP_ID,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidResponseError);
        const message = (error as Error).message;
        expect(message).toMatch(/502/);
        expect(message).not.toContain(SECRET_TOKEN);
        expect(message).not.toContain(SECRET_GROUP_ID);
        expect(message).not.toMatch(/<html/i);
        expect(message).not.toContain('leak');
      }
    } finally {
      mock.restore();
    }
  });

  it('hides secrets when the cookieOverride value appears in the response body', async () => {
    const mock = installFetchMock(async () =>
      textResponse(
        500,
        `Set-Cookie: _token=${SECRET_COOKIE}; leaked body containing group id ${SECRET_GROUP_ID}`,
      ),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: SECRET_GROUP_ID,
          cookieOverride: SECRET_COOKIE,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toMatch(/500/);
        expect(message).not.toContain(SECRET_COOKIE);
        expect(message).not.toContain(SECRET_TOKEN);
        expect(message).not.toContain(SECRET_GROUP_ID);
      }
    } finally {
      mock.restore();
    }
  });

  it('hides secrets when the server returns non-JSON content', async () => {
    const mock = installFetchMock(async () =>
      textResponse(200, `<html><script>var token="${SECRET_TOKEN}"</script></html>`),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: SECRET_GROUP_ID,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain(SECRET_TOKEN);
        expect(message).not.toContain(SECRET_GROUP_ID);
        expect(message).not.toMatch(/<html/i);
        expect(message).not.toMatch(/<script/i);
        expect(message).not.toMatch(/position: \d+/);
      }
    } finally {
      mock.restore();
    }
  });

  it('hides base_resp status_msg when it leaks credentials', async () => {
    const mock = installFetchMock(async () =>
      jsonResponse(200, {
        base_resp: {
          status_code: 1004,
          status_msg: `auth failed for token=${SECRET_TOKEN} group=${SECRET_GROUP_ID}`,
        },
      }),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: SECRET_GROUP_ID,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain(SECRET_TOKEN);
        expect(message).not.toContain(SECRET_GROUP_ID);
      }
    } finally {
      mock.restore();
    }
  });

  it('preserves HTTP status code but never the body snippet', async () => {
    const mock = installFetchMock(async () =>
      textResponse(
        503,
        'service unavailable, includes token eyJhbGciOiJIUzI1NiJ9.REALSECRETTOKENVALUE123456789',
      ),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: null,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('503');
        expect(message).not.toContain('REALSECRETTOKENVALUE123456789');
        expect(message).not.toMatch(/^.{0,200}token=/);
      }
    } finally {
      mock.restore();
    }
  });

  it('reports 401/403 as InvalidTokenError with the status only', async () => {
    const mock = installFetchMock(async () =>
      textResponse(401, `unauthorized; token=${SECRET_TOKEN}`),
    );

    try {
      try {
        await fetchTokenPlan({
          baseUrl: OFFICIAL_BASE_URL,
          token: SECRET_TOKEN,
          groupId: null,
        });
        throw new Error('expected fetchTokenPlan to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTokenError);
        const message = (error as Error).message;
        expect(message).toContain('401');
        expect(message).not.toContain(SECRET_TOKEN);
        expect(message).not.toContain('unauthorized; token');
      }
    } finally {
      mock.restore();
    }
  });
});

describe('fetchTokenPlan percentage parsing', () => {
  let mock: { restore: () => void };

  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    mock.restore();
  });

  it('parses string percentages with trailing %', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: '12.5%',
            current_interval_total_percent: '100%',
            current_weekly_used_percent: '7%',
            end_time: 1_750_000_000,
          },
        ],
      }),
    );

    const snapshot = await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: SAFE_GROUP_ID,
    });

    expect(snapshot.primary).toEqual(
      expect.objectContaining({
        model: 'general',
        usedPercent: 12.5,
        totalPercent: 100,
        remainingPercent: 87.5,
        weeklyUsedPercent: 7,
      }),
    );
  });

  it('parses numeric percentages without %', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 33,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000,
          },
        ],
      }),
    );

    const snapshot = await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: null,
    });

    expect(snapshot.primary?.usedPercent).toBe(33);
    expect(snapshot.primary?.remainingPercent).toBe(67);
  });

  it('normalizes Unix-seconds end_time to milliseconds', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 10,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000,
          },
        ],
      }),
    );

    const snapshot = await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: null,
    });

    expect(snapshot.primary?.resetAt).toBe(1_750_000_000_000);
  });
});

describe('fetchTokenPlan real official endpoint behavior', () => {
  let mock: { restore: () => void };

  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    mock.restore();
  });

  it('targets the official token_plan/remains_percent path on the configured base', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 5,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000_000,
          },
        ],
      }),
    );

    await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: SAFE_GROUP_ID,
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe(
      'https://www.minimaxi.com/backend/account/token_plan/remains_percent',
    );
  });

  it('sets Origin and Referer matching the official MiniMax platform', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 1,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000_000,
          },
        ],
      }),
    );

    await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: SAFE_GROUP_ID,
    });

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['Origin']).toBe('https://platform.minimaxi.com');
    expect(headers['Referer']).toBe('https://platform.minimaxi.com/');
  });

  it('sends only the token and group id in the Cookie header when no override is set', async () => {
    mock = installFetchMock(async () =>
      jsonResponse(200, {
        model_remains: [
          {
            model_name: 'general',
            current_interval_used_percent: 1,
            current_interval_total_percent: 100,
            end_time: 1_750_000_000_000,
          },
        ],
      }),
    );

    await fetchTokenPlan({
      baseUrl: OFFICIAL_BASE_URL,
      token: SAFE_TOKEN,
      groupId: SAFE_GROUP_ID,
    });

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['Cookie']).toBe(`_token=${SAFE_TOKEN}; minimax_group_id_v2=${SAFE_GROUP_ID}`);
  });
});