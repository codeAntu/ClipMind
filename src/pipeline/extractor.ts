import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { errorMessage } from '../lib/errors';

export interface MediaPaths {
  framesDir: string;
  audioPath: string;
}

export function getPaths(fileHash: string): MediaPaths {
  return {
    framesDir: path.join(config.cacheDir, 'frames', fileHash),
    audioPath: path.join(config.cacheDir, 'audio', `${fileHash}.wav`),
  };
}

function probeDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

async function extractFrames(
  videoPath: string,
  framesDir: string,
  intervalSeconds: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vf', `fps=1/${intervalSeconds}`])
      .output(path.join(framesDir, 'frame-%03d.png'))
      .on('end', () => resolve())
      .on('error', (err) =>
        reject(new Error(`Frame extraction failed: ${err.message}`))
      )
      .run();
  });
}

async function extractAudio(videoPath: string, audioPath: string): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
    return true;
  } catch (err) {
    console.warn(`No audio track extracted: ${errorMessage(err)}`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    return false;
  }
}

export async function extractMedia(videoPath: string, fileHash: string) {
  const { framesDir, audioPath } = getPaths(fileHash);
  const interval = config.ocrIntervalSeconds;

  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(audioPath), { recursive: true });

  const duration = await probeDuration(videoPath);

  console.log(`Extracting frames (1 every ${interval}s)...`);
  await extractFrames(videoPath, framesDir, interval);

  console.log('Extracting audio (16kHz mono)...');
  const hasAudio = await extractAudio(videoPath, audioPath);

  return {
    framesDir,
    audioPath: hasAudio ? audioPath : '',
    duration: Math.round(duration),
  };
}

export function cleanupMediaCache(fileHash: string): void {
  const { framesDir, audioPath } = getPaths(fileHash);
  try {
    if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  } catch (err) {
    console.warn(`Cache cleanup failed: ${errorMessage(err)}`);
  }
}
