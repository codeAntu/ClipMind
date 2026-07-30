import { createWorker, type Worker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

async function recognizeFrame(worker: Worker, filePath: string): Promise<string> {
  try {
    const { data } = await worker.recognize(filePath);
    return data.text.trim();
  } catch {
    return '';
  }
}

export async function performOCR(framesDir: string): Promise<string> {
  if (!fs.existsSync(framesDir)) return '';

  const files = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => path.join(framesDir, f));

  if (files.length === 0) return '';

  const cachePath = path.join(config.cacheDir, 'tesseract');
  fs.mkdirSync(cachePath, { recursive: true });

  const concurrency = Math.max(1, Math.min(config.ocrConcurrency, files.length));
  const workers: Worker[] = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push(await createWorker('eng', 1, { cachePath }));
  }

  const lines: string[] = [];

  try {
    let next = 0;

    await Promise.all(
      workers.map(async (worker) => {
        while (next < files.length) {
          const index = next++;
          const text = await recognizeFrame(worker, files[index]);
          if (text) lines[index] = text;
        }
      })
    );
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
  }

  return lines.filter(Boolean).join('\n');
}
