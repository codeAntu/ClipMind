import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { StepStatus } from '../types';

export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filePath: text('file_path').notNull().unique(),
  fileHash: text('file_hash').notNull(),
  duration: integer('duration'),
  audioExtracted: integer('audio_extracted', { mode: 'boolean' }).default(false).notNull(),
  framesExtracted: integer('frames_extracted', { mode: 'boolean' }).default(false).notNull(),
  ocrText: text('ocr_text'),
  ocrStatus: text('ocr_status').$type<StepStatus>().default('pending').notNull(),
  transcription: text('transcription'),
  transcriptionStatus: text('transcription_status').$type<StepStatus>().default('pending').notNull(),
  cleanedText: text('cleaned_text'),
  tags: text('tags'),
  taggingStatus: text('tagging_status').$type<StepStatus>().default('pending').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Video = typeof videos.$inferSelect;
export type VideoUpdate = Partial<Omit<Video, 'id' | 'fileHash' | 'createdAt'>>;
