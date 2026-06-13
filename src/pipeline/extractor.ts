import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

export interface ExtractionResult {
  framesDir: string;
  audioPath: string;
  duration: number;
}

export function getPaths(fileHash: string) {
  // Resolved relative to /app/src/pipeline or wherever the build is
  // In Docker, it's run from /app/dist/ or /app/src/
  const cacheBase = path.resolve(process.cwd(), '.cache');
  return {
    framesDir: path.join(cacheBase, 'frames', fileHash),
    audioPath: path.join(cacheBase, 'audio', `${fileHash}.wav`),
  };
}

export async function extractMedia(
  videoPath: string,
  fileHash: string,
  intervalSeconds: number = 2
): Promise<ExtractionResult> {
  const { framesDir, audioPath } = getPaths(fileHash);

  // Ensure directories exist
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(audioPath), { recursive: true });

  // Get video metadata (duration)
  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });

  console.log(`Extracting frames from ${videoPath} at 1 frame every ${intervalSeconds}s...`);

  // Extract frames
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vf', `fps=1/${intervalSeconds}`
      ])
      .output(path.join(framesDir, 'frame-%03d.png'))
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg frame extraction failed: ${err.message}`));
      })
      .run();
  });

  console.log(`Extracting audio from ${videoPath} (16kHz mono)...`);

  // Extract audio (16kHz mono WAV for Whisper)
  const audioExists = await new Promise<boolean>((resolve) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(audioPath)
      .on('end', () => {
        resolve(true);
      })
      .on('error', (err) => {
        console.warn(`Warning: Could not extract audio track for ${videoPath} (${err.message}). Video might be silent.`);
        // Clean up audio path if it was partially written
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        resolve(false);
      })
      .run();
  });

  return {
    framesDir,
    audioPath: audioExists ? audioPath : '',
    duration: Math.round(duration),
  };
}
export function cleanupMediaCache(fileHash: string) {
  const { framesDir, audioPath } = getPaths(fileHash);
  try {
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    console.log(`Cleaned up temporary extraction cache for hash ${fileHash}`);
  } catch (err: any) {
    console.warn(`Failed to clean up cache for hash ${fileHash}: ${err.message}`);
  }
}
