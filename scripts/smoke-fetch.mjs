import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import {
  fetchTokenPlan,
  InvalidTokenError,
  InvalidResponseError,
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

console.log(`[smoke] baseUrl=${baseUrl} groupId=${groupId ?? '—'} tokenLength=${token.length}`);
console.log(
  `[smoke] cookieOverride=${cookieOverride ? `<${cookieOverride.length} bytes>` : '— (using JWT as _token)'}`,
);

try {
  const snapshot = await fetchTokenPlan({ baseUrl, token, groupId, cookieOverride });
  console.log(`[smoke] fetchedAt=${new Date(snapshot.fetchedAt).toISOString()}`);
  for (const model of snapshot.models) {
    console.log(
      `[smoke] model=${model.model} used=${model.usedPercent}% remaining=${model.remainingPercent}% weekly=${model.weeklyUsedPercent}% total=${model.totalPercent}% resetAt=${model.resetAt}`,
    );
  }
} catch (error) {
  if (error instanceof InvalidTokenError) {
    console.error(`[smoke] invalid token: ${error.message}`);
    process.exit(1);
  }
  if (error instanceof InvalidResponseError) {
    console.error(`[smoke] invalid response: ${error.message}`);
    process.exit(1);
  }
  console.error('[smoke] unexpected error', error);
  process.exit(1);
}
