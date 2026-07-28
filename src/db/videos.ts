import { eq } from 'drizzle-orm';
import { db } from './index';
import { videos, type Video, type VideoUpdate } from './schema';
import { rankVideos } from '../lib/search';

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
  if (existing) {
    if (existing.filePath !== filePath) {
      updateVideo(fileHash, { filePath });
      return { video: { ...existing, filePath }, created: false as const };
    }
    return { video: existing, created: false as const };
  }
  return { video: createVideo(filePath, fileHash), created: true as const };
}

/** Crash mid-step can leave status as "processing" — treat as pending. */
export function clearStuckProcessing(video: Video): Video {
  const patch: VideoUpdate = {};
  if (video.ocrStatus === 'processing') patch.ocrStatus = 'pending';
  if (video.transcriptionStatus === 'processing') patch.transcriptionStatus = 'pending';
  if (video.taggingStatus === 'processing') patch.taggingStatus = 'pending';

  if (Object.keys(patch).length === 0) return video;
  updateVideo(video.fileHash, patch);
  return { ...video, ...patch };
}

export function listTagRows() {
  return db.select({ tags: videos.tags }).from(videos).all();
}

export function listAllVideos(): Video[] {
  return db.select().from(videos).all();
}

export function searchVideos(query: string): Video[] {
  return rankVideos(listAllVideos(), query);
}
