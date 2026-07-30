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

export type StepTiming = {
  extract: number;
  ocr: number;
  whisper: number;
  filter: number;
  gemini: number;
  total: number;
};

const totals: StepTiming = {
  extract: 0,
  ocr: 0,
  whisper: 0,
  filter: 0,
  gemini: 0,
  total: 0,
};

let processedCount = 0;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

function timedSync<T>(fn: () => T): { value: T; ms: number } {
  const start = Date.now();
  const value = fn();
  return { value, ms: Date.now() - start };
}

export function getTimingTotals(): { count: number; totals: StepTiming } {
  return { count: processedCount, totals: { ...totals } };
}

export async function processVideo(absolutePath: string): Promise<'skipped' | 'processed'> {
  const relativePath = path.relative(config.videosDir, absolutePath);
  const fileHash = await getFileHash(absolutePath);
  const { video } = findOrCreateVideo(relativePath, fileHash);

  if (video.status === 'done' && !config.forceReprocess) return 'skipped';

  const videoStart = Date.now();

  try {
    const extract = await timed(() => extractMedia(absolutePath, fileHash));

    const ocr = await timed(() => performOCR(extract.value.framesDir));

    const whisper = config.enableWhisper
      ? await timed(() => transcribeAudio(extract.value.audioPath, fileHash))
      : { value: '', ms: 0 };

    const filter = timedSync(() =>
      cleanAndFilterText(ocr.value, whisper.value)
    );

    const gemini = await timed(async () =>
      serializeTags(await generateTags(filter.value))
    );

    saveResult(fileHash, {
      duration: extract.value.duration,
      text: filter.value,
      tags: gemini.value,
    });

    if (config.deleteCacheAfterProcessing) {
      cleanupMediaCache(fileHash);
    }

    const total = Date.now() - videoStart;
    processedCount += 1;
    totals.extract += extract.ms;
    totals.ocr += ocr.ms;
    totals.whisper += whisper.ms;
    totals.filter += filter.ms;
    totals.gemini += gemini.ms;
    totals.total += total;

    console.log(
      `  timing  extract=${extract.ms}ms  ocr=${ocr.ms}ms  whisper=${whisper.ms}ms  filter=${filter.ms}ms  gemini=${gemini.ms}ms  total=${total}ms`
    );

    return 'processed';
  } catch (err) {
    markFailed(fileHash);
    throw err;
  }
}
