import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const sqlite = new Database(config.databasePath);
export const db = drizzle(sqlite);

export function ensureSchema(): void {
  const columns = sqlite.prepare('PRAGMA table_info(videos)').all() as Array<{ name: string }>;
  const isLegacy = columns.some((c) => c.name === 'ocr_status' || c.name === 'cleaned_text');

  if (isLegacy) {
    sqlite.exec('DROP TABLE videos');
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_hash TEXT NOT NULL,
      duration INTEGER,
      text TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
