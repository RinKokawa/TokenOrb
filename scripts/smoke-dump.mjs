import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import {
  fetchTokenPlan,
  InvalidResponseError,
  InvalidTokenError,
} from '../dist-electron/api/minimax.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
loadEnv({ path: path.join(projectRoot, '.env') });

const token = process.env.MINIMAX_TOKEN?.trim();
const groupId = process.env.MINIMAX_GROUP_ID?.trim() || null;
const baseUrl = process.env.MINIMAX_BASE_URL?.trim() || 'https://www.minimaxi.com';
const cookieOverride = process.env.MINIMAX_COOKIE?.trim() || null;

if (!token) {
  console.error('MINIMAX_TOKEN is not set in .env');
  process.exit(2);
}

console.log(`[dump] baseUrl=${baseUrl} groupId=${groupId ?? '—'} tokenLength=${token.length}`);
console.log(
  `[dump] cookieOverride=${cookieOverride ? `<${cookieOverride.length} bytes>` : '— (using _token cookie)'}`,
);

try {
  const snapshot = await fetchTokenPlan({ baseUrl, token, groupId, cookieOverride });
  console.log(`[dump] fetchedAt=${new Date(snapshot.fetchedAt).toISOString()}`);
  console.log(`[dump] url=${snapshot.baseUrl}`);
  console.log(`[dump] primary=${snapshot.primary?.model ?? '—'}`);
  console.log(
    `[dump] remainingPercent=${snapshot.primary?.remainingPercent ?? '—'} usedPercent=${snapshot.primary?.usedPercent ?? '—'} weeklyUsedPercent=${snapshot.primary?.weeklyUsedPercent ?? '—'} resetAt=${snapshot.primary?.resetAt ?? '—'}`,
  );
  console.log(`[dump] snapshot=`, JSON.stringify(snapshot, null, 2));
} catch (error) {
  if (error instanceof InvalidTokenError) {
    console.error(`[dump] invalid token: ${error.message}`);
    process.exit(1);
  }
  if (error instanceof InvalidResponseError) {
    console.error(`[dump] invalid response: ${error.message}`);
    process.exit(1);
  }
  console.error('[dump] unexpected error', error);
  process.exit(1);
}
