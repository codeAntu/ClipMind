import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const sqlite = new Database(config.databasePath);
export const db = drizzle(sqlite);

export function ensureSchema(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_hash TEXT NOT NULL,
      duration INTEGER,
      audio_extracted INTEGER NOT NULL DEFAULT 0,
      frames_extracted INTEGER NOT NULL DEFAULT 0,
      ocr_text TEXT,
      ocr_status TEXT NOT NULL DEFAULT 'pending',
      transcription TEXT,
      transcription_status TEXT NOT NULL DEFAULT 'pending',
      cleaned_text TEXT,
      tags TEXT,
      tagging_status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
