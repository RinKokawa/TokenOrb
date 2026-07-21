import dotenv from 'dotenv';
import path from 'node:path';
import { app } from 'electron';

const envPath = path.join(__dirname, '../.env');

dotenv.config({ path: envPath, override: false });

export type RuntimeConfig = {
  baseUrl: string;
  token: string | null;
  groupId: string | null;
  cookieOverride: string | null;
};

const readEnvValue = (key: string): string | null => {
  const value = process.env[key];
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const loadRuntimeConfig = (): RuntimeConfig => {
  if (app.isPackaged) {
    dotenv.config({ path: path.join(process.resourcesPath, '.env'), override: false });
  }

  return {
    baseUrl: readEnvValue('MINIMAX_BASE_URL') ?? 'https://www.minimaxi.com',
    token: readEnvValue('MINIMAX_TOKEN'),
    groupId: readEnvValue('MINIMAX_GROUP_ID'),
    cookieOverride: readEnvValue('MINIMAX_COOKIE'),
  };
};