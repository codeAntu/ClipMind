import * as path from 'path';
import { config } from '../config';
import {
  clearStuckProcessing,
  findOrCreateVideo,
  updateVideo,
} from '../db/videos';
import type { Video, VideoUpdate } from '../db/schema';
import { getFileHash } from '../lib/files';
import { serializeTags } from '../lib/format';
import type { StepStatus } from '../types';
import {
  cleanupMediaCache,
  extractMedia,
  getPaths,
  isMediaCacheReady,
} from './extractor';
import { cleanAndFilterText } from './filter';
import { performOCR } from './ocr';
import { generateTags } from './tagger';
import { transcribeAudio } from './transcribe';

type StatusField = 'ocrStatus' | 'transcriptionStatus' | 'taggingStatus';

function logOutput(label: string, body: string) {
  console.log(`\n[${label}]\n---\n${body || '(empty)'}\n---\n`);
}

function isDone(video: Video) {
  return (
    video.framesExtracted &&
    video.ocrStatus === 'done' &&
    video.transcriptionStatus === 'done' &&
    video.taggingStatus === 'done'
  );
}

function apply(video: Video, patch: VideoUpdate): Video {
  updateVideo(video.fileHash, patch);
  return { ...video, ...patch };
}

async function trackedStep(
  video: Video,
  field: StatusField,
  work: () => Promise<VideoUpdate>
): Promise<Video> {
  if (video[field] === 'done') return video;

  apply(video, { [field]: 'processing' as StepStatus });

  try {
    const patch = await work();
    return apply(video, { ...patch, [field]: 'done' as StepStatus });
  } catch (err) {
    apply(video, { [field]: 'failed' as StepStatus });
    throw err;
  }
}

async function extract(video: Video, absolutePath: string): Promise<Video> {
  const cacheOk = isMediaCacheReady(video.fileHash, video.audioExtracted);

  if (video.framesExtracted && cacheOk) {
    console.log('[1/5] Media already extracted');
    return video;
  }

  console.log(
    video.framesExtracted && !cacheOk
      ? '[1/5] Cache missing — re-extracting media...'
      : '[1/5] Extracting media...'
  );

  const result = await extractMedia(absolutePath, video.fileHash);
  return apply(video, {
    audioExtracted: !!result.audioPath,
    framesExtracted: true,
    duration: result.duration,
  });
}

async function ocr(video: Video, framesDir: string): Promise<Video> {
  if (video.ocrStatus === 'done') return video;

  console.log('[2/5] Running OCR...');
  return trackedStep(video, 'ocrStatus', async () => ({
    ocrText: await performOCR(framesDir),
  }));
}

async function whisper(video: Video, audioPath: string): Promise<Video> {
  if (video.transcriptionStatus === 'done') return video;

  console.log('[3/5] Transcribing...');
  return trackedStep(video, 'transcriptionStatus', async () => ({
    transcription: await transcribeAudio(
      video.audioExtracted ? audioPath : '',
      video.fileHash
    ),
  }));
}

function filter(video: Video): Video {
  console.log('[4/5] Cleaning text...');
  const cleanedText = cleanAndFilterText(video.ocrText || '', video.transcription || '');
  logOutput('Filter', cleanedText || '(empty)');
  return apply(video, { cleanedText });
}

async function tag(video: Video): Promise<Video> {
  if (video.taggingStatus === 'done') {
    console.log('[5/5] Tags cached');
    logOutput('Tags', video.tags || '[]');
    return video;
  }

  console.log('[5/5] Generating tags...');
  return trackedStep(video, 'taggingStatus', async () => {
    const tags = serializeTags(await generateTags(video.cleanedText || ''));
    logOutput('Tags', tags);
    return { tags };
  });
}

export async function processVideo(absolutePath: string): Promise<'skipped' | 'processed'> {
  const relativePath = path.relative(config.videosDir, absolutePath);
  const fileHash = await getFileHash(absolutePath);
  const { video: saved, created } = findOrCreateVideo(relativePath, fileHash);
  let video = clearStuckProcessing(saved);

  console.log(`Hash: ${fileHash}`);

  if (isDone(video)) {
    console.log(`Already done — skipping. Tags: ${video.tags}`);
    return 'skipped';
  }

  console.log(created ? 'New video — starting pipeline' : 'Resuming incomplete video');

  const { framesDir, audioPath } = getPaths(fileHash);
  video = await extract(video, absolutePath);

  const [ocrDone, whisperDone] = await Promise.allSettled([
    ocr(video, framesDir),
    whisper(video, audioPath),
  ]);

  if (ocrDone.status === 'fulfilled') {
    video = {
      ...video,
      ocrText: ocrDone.value.ocrText,
      ocrStatus: ocrDone.value.ocrStatus,
    };
  }

  if (whisperDone.status === 'fulfilled') {
    video = {
      ...video,
      transcription: whisperDone.value.transcription,
      transcriptionStatus: whisperDone.value.transcriptionStatus,
    };
  }

  if (ocrDone.status === 'rejected') throw ocrDone.reason;
  if (whisperDone.status === 'rejected') throw whisperDone.reason;

  logOutput('OCR', video.ocrText || '(no text)');
  logOutput('Whisper', video.transcription || '(no speech)');

  video = filter(video);
  video = await tag(video);

  if (config.deleteCacheAfterProcessing) {
    console.log('Cleaning cache...');
    cleanupMediaCache(fileHash);
  }

  console.log(`Done: ${relativePath}`);
  return 'processed';
}
