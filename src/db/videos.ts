import { desc, eq } from 'drizzle-orm';
import { db } from './index';
import { videos, type Video, type VideoUpdate } from './schema';
import { rankVideos } from '../lib/search';

export function findByHash(fileHash: string): Video | undefined {
  return db.select().from(videos).where(eq(videos.fileHash, fileHash)).get();
}

export function findById(id: number): Video | undefined {
  return db.select().from(videos).where(eq(videos.id, id)).get();
}

export function createVideo(filePath: string, fileHash: string): Video {
  const now = new Date();
  return db
    .insert(videos)
    .values({
      filePath,
      fileHash,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function updateVideo(fileHash: string, fields: VideoUpdate): void {
  db.update(videos)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(videos.fileHash, fileHash))
    .run();
}

export function findOrCreateVideo(filePath: string, fileHash: string) {
  const existing = findByHash(fileHash);
  if (existing) {
    if (existing.filePath !== filePath) {
      updateVideo(fileHash, { filePath });
      return { video: { ...existing, filePath }, created: false as const };
    }
    return { video: existing, created: false as const };
  }
  return { video: createVideo(filePath, fileHash), created: true as const };
}

export function saveResult(
  fileHash: string,
  result: { duration: number; text: string; tags: string }
): void {
  updateVideo(fileHash, { ...result, status: 'done' });
}

export function markFailed(fileHash: string): void {
  updateVideo(fileHash, { status: 'failed' });
}

export function listTagRows() {
  return db.select({ tags: videos.tags }).from(videos).all();
}

export function listAllVideos(): Video[] {
  return db.select().from(videos).orderBy(desc(videos.id)).all();
}

export function searchVideos(query: string): Video[] {
  return rankVideos(listAllVideos(), query);
}
