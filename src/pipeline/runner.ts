import * as path from 'path';
import { config } from '../config';
import { findOrCreateVideo, markFailed, saveResult } from '../db/videos';
import { getFileHash } from '../lib/files';
import { serializeTags } from '../lib/format';
import { cleanupMediaCache, extractMedia } from './extractor';
import { cleanAndFilterText } from './filter';
import { performOCR } from './ocr';
import { generateTags } from './tagger';
import { transcribeAudio } from './transcribe';

export async function processVideo(absolutePath: string): Promise<'skipped' | 'processed'> {
  const relativePath = path.relative(config.videosDir, absolutePath);
  const fileHash = await getFileHash(absolutePath);
  const { video } = findOrCreateVideo(relativePath, fileHash);

  if (video.status === 'done') return 'skipped';

  try {
    const media = await extractMedia(absolutePath, fileHash);

    const [ocrText, transcription] = await Promise.all([
      performOCR(media.framesDir),
      transcribeAudio(media.audioPath, fileHash),
    ]);

    const text = cleanAndFilterText(ocrText, transcription);
    const tags = serializeTags(await generateTags(text));

    saveResult(fileHash, { duration: media.duration, text, tags });

    if (config.deleteCacheAfterProcessing) {
      cleanupMediaCache(fileHash);
    }

    return 'processed';
  } catch (err) {
    markFailed(fileHash);
    throw err;
  }
}
