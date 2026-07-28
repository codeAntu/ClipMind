import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { errorMessage } from '../lib/errors';

export async function performOCR(framesDir: string): Promise<string> {
  if (!fs.existsSync(framesDir)) return '';

  const files = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.png'))
    .sort();

  if (files.length === 0) return '';

  console.log(`Running OCR on ${files.length} frames...`);

  const cachePath = path.join(config.cacheDir, 'tesseract');
  fs.mkdirSync(cachePath, { recursive: true });

  const worker = await createWorker('eng', 1, { cachePath });
  const lines: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        console.log(`[OCR] ${i + 1}/${files.length} ${file}`);
        const { data } = await worker.recognize(path.join(framesDir, file));
        const text = data.text.trim();
        if (text) lines.push(text);
      } catch (err) {
        console.error(`[OCR] Failed on ${file}: ${errorMessage(err)}`);
      }
    }
  } finally {
    await worker.terminate();
  }

  return lines.join('\n');
}
