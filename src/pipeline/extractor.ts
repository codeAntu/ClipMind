import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export function getPaths(fileHash: string) {
  return {
    framesDir: path.join(config.cacheDir, 'frames', fileHash),
    audioPath: path.join(config.cacheDir, 'audio', `${fileHash}.wav`),
  };
}

function run(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command.on('end', () => resolve()).on('error', reject).run();
  });
}

function probeDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration || 0);
    });
  });
}

function clearCache(framesDir: string, audioPath: string) {
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
  if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
}

async function extractFrames(videoPath: string, framesDir: string, everySeconds: number) {
  await run(
    ffmpeg(videoPath)
      .outputOptions(['-vf', `fps=1/${everySeconds}`])
      .output(path.join(framesDir, 'frame-%03d.png'))
  );
}

async function extractAudio(videoPath: string, audioPath: string): Promise<boolean> {
  try {
    await run(
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(audioPath)
    );
    return true;
  } catch {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    return false;
  }
}

export async function extractMedia(videoPath: string, fileHash: string) {
  const { framesDir, audioPath } = getPaths(fileHash);

  clearCache(framesDir, audioPath);
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(audioPath), { recursive: true });

  const duration = Math.round(await probeDuration(videoPath));
  await extractFrames(videoPath, framesDir, config.ocrIntervalSeconds);

  const hasAudio = config.enableWhisper
    ? await extractAudio(videoPath, audioPath)
    : false;

  return {
    framesDir,
    audioPath: hasAudio ? audioPath : '',
    duration,
  };
}

export function cleanupMediaCache(fileHash: string) {
  const { framesDir, audioPath } = getPaths(fileHash);
  try {
    clearCache(framesDir, audioPath);
  } catch {
    // ignore cleanup errors
  }
}
