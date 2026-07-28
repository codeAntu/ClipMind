import { eq, like, or } from 'drizzle-orm';
import { db } from './index';
import { videos, type Video, type VideoUpdate } from './schema';

export function findByHash(fileHash: string): Video | undefined {
  return db.select().from(videos).where(eq(videos.fileHash, fileHash)).get();
}

export function createVideo(filePath: string, fileHash: string): Video {
  const now = new Date();
  return db
    .insert(videos)
    .values({
      filePath,
      fileHash,
      audioExtracted: false,
      framesExtracted: false,
      ocrStatus: 'pending',
      transcriptionStatus: 'pending',
      taggingStatus: 'pending',
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
  if (existing) return { video: existing, created: false as const };
  return { video: createVideo(filePath, fileHash), created: true as const };
}

export function listTagRows() {
  return db.select({ tags: videos.tags }).from(videos).all();
}

export function searchVideos(query: string): Video[] {
  const pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
  return db
    .select()
    .from(videos)
    .where(
      or(
        like(videos.tags, pattern),
        like(videos.cleanedText, pattern),
        like(videos.filePath, pattern)
      )
    )
    .all();
}
