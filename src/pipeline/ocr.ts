import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export async function performOCR(framesDir: string): Promise<string> {
  if (!fs.existsSync(framesDir)) return '';

  const files = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.png'))
    .sort();

  if (files.length === 0) return '';

  const cachePath = path.join(config.cacheDir, 'tesseract');
  fs.mkdirSync(cachePath, { recursive: true });

  const worker = await createWorker('eng', 1, { cachePath });
  const lines: string[] = [];

  try {
    for (const file of files) {
      try {
        const { data } = await worker.recognize(path.join(framesDir, file));
        const text = data.text.trim();
        if (text) lines.push(text);
      } catch {
        // skip bad frames
      }
    }
  } finally {
    await worker.terminate();
  }

  return lines.join('\n');
}
