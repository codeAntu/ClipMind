import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as path from 'path';
import * as fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/clipmind.db');

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

export function runMigrations() {
  console.log('Running database migrations...');
  const migrationsFolder = path.join(__dirname, '../../drizzle');
  
  // Ensure table exists via raw SQL as a robust fallback
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
  console.log('Database schema verified.');

  // Attempt standard Drizzle migration if the migrations folder exists
  if (fs.existsSync(migrationsFolder) && fs.readdirSync(migrationsFolder).length > 0) {
    try {
      migrate(db, { migrationsFolder });
      console.log('Drizzle migrations completed successfully.');
    } catch (err) {
      console.error('Failed to run Drizzle migrations, falling back to manual schema:', err);
    }
  }
}
export * as schema from './schema';
