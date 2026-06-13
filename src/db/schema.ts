import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filePath: text('file_path').notNull().unique(),
  fileHash: text('file_hash').notNull(),
  duration: integer('duration'), // duration in seconds
  audioExtracted: integer('audio_extracted', { mode: 'boolean' }).default(false).notNull(),
  framesExtracted: integer('frames_extracted', { mode: 'boolean' }).default(false).notNull(),
  ocrText: text('ocr_text'),
  ocrStatus: text('ocr_status').default('pending').notNull(), // 'pending', 'done', 'failed'
  transcription: text('transcription'),
  transcriptionStatus: text('transcription_status').default('pending').notNull(), // 'pending', 'done', 'failed'
  cleanedText: text('cleaned_text'),
  tags: text('tags'), // JSON string, e.g. '["tag1", "tag2"]'
  taggingStatus: text('tagging_status').default('pending').notNull(), // 'pending', 'done', 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
