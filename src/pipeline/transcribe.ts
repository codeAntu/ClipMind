import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { config } from '../config';
import { errorMessage } from '../lib/errors';

const execFileAsync = promisify(execFile);

export async function transcribeAudio(
  audioPath: string,
  fileHash: string
): Promise<string> {
  if (!audioPath || !fs.existsSync(audioPath)) return '';

  const outputDir = path.join(config.cacheDir, 'transcripts', fileHash);
  const txtFile = path.join(outputDir, `${path.basename(audioPath, '.wav')}.txt`);
  fs.mkdirSync(outputDir, { recursive: true });

  if (fs.existsSync(txtFile)) {
    return fs.readFileSync(txtFile, 'utf8').trim();
  }

  try {
    await execFileAsync(
      'whisper',
      [
        audioPath,
        '--model', config.whisperModel,
        '--output_dir', outputDir,
        '--output_format', 'txt',
      ],
      { timeout: config.whisperTimeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    throw new Error(`Whisper failed: ${errorMessage(err)}`);
  }

  if (!fs.existsSync(txtFile)) {
    throw new Error(`Whisper output missing: ${txtFile}`);
  }

  const text = fs.readFileSync(txtFile, 'utf8').trim();
  fs.rmSync(outputDir, { recursive: true, force: true });
  return text;
}
