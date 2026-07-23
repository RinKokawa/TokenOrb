import { Buffer } from 'node:buffer';
import type { TokenPlanModel, TokenPlanSnapshot } from '../shared/token';

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

type RawModelRemains = {
  model_name?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  current_interval_used_percent?: unknown;
  current_interval_total_percent?: unknown;
  weekly_start_time?: unknown;
  weekly_end_time?: unknown;
  current_weekly_used_percent?: unknown;
  base_resp?: unknown;
};

type RawResponse = {
  model_remains?: unknown;
  base_resp?: unknown;
};

const REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0';
const BROWSER_ORIGIN = 'https://platform.minimaxi.com';
const BROWSER_REFERER = 'https://platform.minimaxi.com/';
const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6';
const TOKEN_COOKIE_NAME = '_token';
const GROUP_COOKIE_NAME = 'minimax_group_id_v2';
const TOKEN_PLAN_PATH = '/backend/account/token_plan/remains_percent';

const SAFE_NETWORK_MESSAGE = 'MiniMax request failed';
const SAFE_TIMEOUT_MESSAGE = 'MiniMax request timed out';
const SAFE_NON_JSON_MESSAGE = 'MiniMax response was not valid JSON';
const SAFE_NON_OK_MESSAGE = (status: number): string => `MiniMax request failed (HTTP ${status})`;
const SAFE_AUTH_MESSAGE = (status: number): string =>
  `MiniMax rejected the cookie/session (HTTP ${status})`;
const SAFE_BASE_RESP_MESSAGE = 'MiniMax reported a non-zero status';
const SAFE_EMPTY_MODEL_MESSAGE = 'MiniMax response did not include any model_remains entries';
const SAFE_URL_MESSAGE = 'MiniMax base URL is not a safe destination';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const UNIX_MILLISECONDS_THRESHOLD = 10_000_000_000;

export const normalizeTimestamp = (value: unknown): number => {
  if (!isFiniteNumber(value) || value <= 0) return 0;
  return value < UNIX_MILLISECONDS_THRESHOLD ? value * 1_000 : value;
};

const parsePercent = (value: unknown): number => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      const parsed = Number(trimmed.slice(0, -1));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return isFiniteNumber(value) ? value : 0;
};

const parseModel = (value: unknown): TokenPlanModel | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as RawModelRemains;
  if (typeof raw.model_name !== 'string') return null;

  const usedPercent = Math.min(100, Math.max(0, parsePercent(raw.current_interval_used_percent)));
  const totalPercent = Math.max(0, parsePercent(raw.current_interval_total_percent));
  const remainingPercent = totalPercent > 0 ? Math.max(0, totalPercent - usedPercent) : 0;
  const weeklyUsedPercent = Math.min(
    150,
    Math.max(0, parsePercent(raw.current_weekly_used_percent)),
  );
  const resetAt = normalizeTimestamp(raw.end_time);

  return {
    model: raw.model_name,
    usedPercent,
    remainingPercent,
    weeklyUsedPercent,
    totalPercent,
    resetAt,
  };
};

const pickPrimary = (models: TokenPlanModel[]): TokenPlanModel | null => {
  if (models.length === 0) return null;
  return models.find((model) => model.model === 'general') ?? models[0] ?? null;
};

const baseRespOk = (raw: RawResponse): boolean => {
  if (!raw.base_resp || typeof raw.base_resp !== 'object') return true;
  const code = (raw.base_resp as { status_code?: unknown }).status_code;
  return !isFiniteNumber(code) || code === 0;
};

export type FetchTokenPlanInput = {
  baseUrl: string;
  token: string;
  groupId: string | null;
  cookieOverride?: string | null;
};

const buildCookieHeader = (input: FetchTokenPlanInput): string => {
  if (input.cookieOverride && input.cookieOverride.trim().length > 0) {
    return input.cookieOverride.trim();
  }
  const parts: string[] = [`${TOKEN_COOKIE_NAME}=${input.token}`];
  if (input.groupId) parts.push(`${GROUP_COOKIE_NAME}=${input.groupId}`);
  return parts.join('; ');
};

const isLoopbackHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (lower === '127.0.0.1' || lower.startsWith('127.')) return true;
  if (lower === '[::1]' || lower.startsWith('[::1]:')) return true;
  return false;
};

const isAmbiguousHost = (host: string): boolean => {
  if (host.length === 0) return true;
  if (/[\s/?#@\\]/.test(host)) return true;
  if (host.includes('..')) return true;
  if (/%/.test(host)) return true;
  return false;
};

export const validateBaseUrl = (rawBaseUrl: unknown): string => {
  if (typeof rawBaseUrl !== 'string') {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }
  const trimmed = rawBaseUrl.trim();
  if (trimmed.length === 0) {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  const protocol = parsed.protocol;
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  const host = parsed.hostname;
  if (host.length === 0 || isAmbiguousHost(host)) {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  if (protocol === 'http:' && !isLoopbackHost(host)) {
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  return `${parsed.protocol}//${parsed.host}`;
};

const buildRequestUrl = (safeBaseUrl: string): string => {
  const base = new URL(safeBaseUrl);
  return new URL(TOKEN_PLAN_PATH, `${base.protocol}//${base.host}`).toString();
};

export const fetchTokenPlan = async (input: FetchTokenPlanInput): Promise<TokenPlanSnapshot> => {
  let safeBaseUrl: string;
  try {
    safeBaseUrl = validateBaseUrl(input.baseUrl);
  } catch (error: unknown) {
    if (error instanceof InvalidResponseError) throw error;
    throw new InvalidResponseError(SAFE_URL_MESSAGE);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const url = buildRequestUrl(safeBaseUrl);
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': ACCEPT_LANGUAGE,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    Cookie: buildCookieHeader(input),
    Origin: BROWSER_ORIGIN,
    Referer: BROWSER_REFERER,
    'User-Agent': DEFAULT_USER_AGENT,
    'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Microsoft Edge";v="150"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new InvalidResponseError(SAFE_TIMEOUT_MESSAGE);
    }
    throw new InvalidResponseError(SAFE_NETWORK_MESSAGE);
  }
  clearTimeout(timer);

  if (response.status === 401 || response.status === 403) {
    throw new InvalidTokenError(SAFE_AUTH_MESSAGE(response.status));
  }
  if (!response.ok) {
    await response.text().catch(() => undefined);
    throw new InvalidResponseError(SAFE_NON_OK_MESSAGE(response.status));
  }

  const rawText = await response.text();
  let parsed: RawResponse;
  try {
    parsed = JSON.parse(rawText) as RawResponse;
  } catch {
    throw new InvalidResponseError(SAFE_NON_JSON_MESSAGE);
  }

  if (!baseRespOk(parsed)) {
    throw new InvalidResponseError(SAFE_BASE_RESP_MESSAGE);
  }

  const list = Array.isArray(parsed.model_remains) ? parsed.model_remains : [];
  const models = list
    .map((entry) => parseModel(entry))
    .filter((entry): entry is TokenPlanModel => entry !== null);

  if (models.length === 0) {
    throw new InvalidResponseError(SAFE_EMPTY_MODEL_MESSAGE);
  }

  return {
    fetchedAt: Date.now(),
    baseUrl: safeBaseUrl,
    models,
    primary: pickPrimary(models),
  };
};

export const isTokenPlanSnapshot = (value: unknown): value is TokenPlanSnapshot => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TokenPlanSnapshot>;
  return (
    isFiniteNumber(candidate.fetchedAt) &&
    typeof candidate.baseUrl === 'string' &&
    Array.isArray(candidate.models)
  );
};

export const decodeCookiePreview = (cookie: string): string => {
  const match = cookie.match(/_token=([^;]+)/);
  if (!match) return '(no _token cookie found)';
  const value = match[1];
  return `_token=${value.slice(0, 6)}...${value.slice(-4)} (${Buffer.byteLength(value, 'utf8')} bytes)`;
};

export const summarizeAuth = (token: string, cookieOverride: string | null): string => {
  if (cookieOverride && cookieOverride.trim().length > 0) {
    return decodeCookiePreview(cookieOverride);
  }
  return `_token=${token.slice(0, 6)}...${token.slice(-4)} (${Buffer.byteLength(token, 'utf8')} bytes)`;
};