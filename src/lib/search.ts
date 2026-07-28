import { parseTags } from './format';
import type { Video } from '../db/schema';

function tokensOf(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/[\s,_-]+/)
    .filter(Boolean);
}

/** Higher score = better match. 0 = no match. */
export function scoreVideo(video: Video, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const tokens = tokensOf(q);
  const tags = parseTags(video.tags).map((t) => t.toLowerCase());
  const filePath = (video.filePath || '').toLowerCase();
  const text = (video.text || '').toLowerCase();

  let score = 0;

  for (const tag of tags) {
    if (tag === q) score += 100;
    else if (tag.includes(q) || q.includes(tag)) score += 50;

    for (const token of tokens) {
      if (tag === token) score += 40;
      else if (tag.includes(token)) score += 20;
    }
  }

  if (filePath.includes(q)) score += 30;
  for (const token of tokens) {
    if (filePath.includes(token)) score += 10;
  }

  if (text.includes(q)) score += 15;
  for (const token of tokens) {
    if (text.includes(token)) score += 5;
  }

  return score;
}

export function rankVideos(videos: Video[], query: string): Video[] {
  return videos
    .map((video) => ({ video, score: scoreVideo(video, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.video);
}
