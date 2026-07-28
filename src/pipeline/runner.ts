import * as path from 'path';
import { config } from '../config';
import { findOrCreateVideo, updateVideo } from '../db/videos';
import type { Video, VideoUpdate } from '../db/schema';
import { getFileHash } from '../lib/files';
import { serializeTags } from '../lib/format';
import type { StepStatus } from '../types';
import { cleanupMediaCache, extractMedia, getPaths } from './extractor';
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
  if (video.audioExtracted && video.framesExtracted) {
    console.log('[1/6] Media already extracted');
    return video;
  }

  console.log('[1/6] Extracting media...');
  const result = await extractMedia(absolutePath, video.fileHash);
  return apply(video, {
    audioExtracted: !!result.audioPath,
    framesExtracted: true,
    duration: result.duration,
  });
}

async function ocr(video: Video, framesDir: string): Promise<Video> {
  if (video.ocrStatus === 'done') {
    console.log('[2/6] OCR cached');
    logOutput('OCR', video.ocrText || '(no text)');
    return video;
  }

  console.log('[2/6] Running OCR...');
  return trackedStep(video, 'ocrStatus', async () => {
    const ocrText = await performOCR(framesDir);
    logOutput('OCR', ocrText || '(no text)');
    return { ocrText };
  });
}

async function whisper(video: Video, audioPath: string): Promise<Video> {
  if (video.transcriptionStatus === 'done') {
    console.log('[3/6] Transcription cached');
    logOutput('Whisper', video.transcription || '(no speech)');
    return video;
  }

  console.log('[3/6] Transcribing...');
  return trackedStep(video, 'transcriptionStatus', async () => {
    const transcription = await transcribeAudio(
      video.audioExtracted ? audioPath : '',
      video.fileHash
    );
    logOutput('Whisper', transcription || '(no speech)');
    return { transcription };
  });
}

function filter(video: Video): Video {
  console.log('[4/6] Cleaning text...');
  const cleanedText = cleanAndFilterText(video.ocrText || '', video.transcription || '');
  logOutput('Filter', cleanedText || '(empty)');
  return apply(video, { cleanedText });
}

async function tag(video: Video): Promise<Video> {
  if (video.taggingStatus === 'done') {
    console.log('[5/6] Tags cached');
    logOutput('Tags', video.tags || '[]');
    return video;
  }

  console.log('[5/6] Generating tags...');
  return trackedStep(video, 'taggingStatus', async () => {
    const tags = serializeTags(await generateTags(video.cleanedText || ''));
    logOutput('Tags', tags);
    return { tags };
  });
}

export async function processVideo(absolutePath: string): Promise<'skipped' | 'processed'> {
  const relativePath = path.relative(config.videosDir, absolutePath);
  const fileHash = getFileHash(absolutePath);
  const { video: saved, created } = findOrCreateVideo(relativePath, fileHash);
  let video = saved;

  console.log(`Hash: ${fileHash}`);

  if (isDone(video)) {
    console.log(`Already done — skipping. Tags: ${video.tags}`);
    return 'skipped';
  }

  console.log(created ? 'New video — starting pipeline' : 'Resuming incomplete video');

  const { framesDir, audioPath } = getPaths(fileHash);

  video = await extract(video, absolutePath);
  video = await ocr(video, framesDir);
  video = await whisper(video, audioPath);
  video = filter(video);
  video = await tag(video);

  if (config.deleteCacheAfterProcessing) {
    console.log('[6/6] Cleaning cache...');
    cleanupMediaCache(fileHash);
  }

  console.log(`Done: ${relativePath}`);
  return 'processed';
}
