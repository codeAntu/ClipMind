import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { VideoStatus } from '../types';

export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filePath: text('file_path').notNull().unique(),
  fileHash: text('file_hash').notNull(),
  duration: integer('duration'),
  text: text('text'),
  tags: text('tags'),
  status: text('status').$type<VideoStatus>().default('pending').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Video = typeof videos.$inferSelect;
export type VideoUpdate = Partial<Omit<Video, 'id' | 'fileHash' | 'createdAt'>>;
