import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
loadEnv({ path: path.join(projectRoot, '.env') });

const token = process.env.MINIMAX_TOKEN?.trim();
const groupId = process.env.MINIMAX_GROUP_ID?.trim() || null;
const baseUrl = process.env.MINIMAX_BASE_URL?.trim() || 'https://www.minimaxi.com';

if (!token) {
  console.error('MINIMAX_TOKEN is not set in .env');
  process.exit(2);
}

const url = new URL('/backend/account/token_plan/remains_percent', baseUrl).toString();
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'token-floating-ball/0.1 (+electron)',
};
if (groupId) headers['X-Group-Id'] = groupId;

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 8_000);

const start = Date.now();
try {
  const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  const elapsed = Date.now() - start;
  const text = await response.text();
  console.log(`[dump] status=${response.status} elapsed=${elapsed}ms`);
  console.log(`[dump] headers:`);
  for (const [k, v] of response.headers.entries()) console.log(`  ${k}: ${v}`);
  console.log(`[dump] body=${text}`);
} catch (error) {
  console.error('[dump] network error:', error);
} finally {
  clearTimeout(timer);
}