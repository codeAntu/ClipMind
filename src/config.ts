import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value !== 'false' && value !== '0';
}

function envInt(key: string, fallback: number): number {
  const parsed = parseInt(process.env[key] || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const root = process.cwd();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  whisperModel: process.env.WHISPER_MODEL || 'base',
  ocrIntervalSeconds: envInt('OCR_INTERVAL_SECONDS', 2),
  deleteCacheAfterProcessing: envBool('DELETE_CACHE_AFTER_PROCESSING', true),
  videosDir: path.resolve(root, 'videos'),
  cacheDir: path.resolve(root, '.cache'),
  databasePath: process.env.DATABASE_PATH || path.resolve(root, 'data', 'clipmind.db'),
  videoExtensions: new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv']),
  maxCleanedTextLength: 4000,
  whisperTimeoutMs: 300_000,
};

export function requireGeminiApiKey(): string {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }
  return config.geminiApiKey;
}
