import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

export async function performOCR(framesDir: string): Promise<string> {
  if (!fs.existsSync(framesDir)) {
    console.warn(`Frames directory ${framesDir} does not exist. Skipping OCR.`);
    return '';
  }

  const files = fs.readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort(); // Sort so frames are processed in order

  if (files.length === 0) {
    return '';
  }

  console.log(`Running OCR on ${files.length} frames...`);
  
  // Set up local cache for tesseract traineddata so it persists on the host
  const cachePath = path.resolve(process.cwd(), '.cache/tesseract');
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }

  const worker = await createWorker('eng', 1, {
    cachePath: cachePath,
    logger: m => {
      // Optional logging. Keep it silent unless debugging is needed.
      // If progress is logged, print it in a compact way.
      if (m.status === 'recognizing' && Math.round(m.progress * 100) % 25 === 0) {
        // print progress occasionally
      }
    }
  });

  const results: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(framesDir, file);
    try {
      console.log(`[OCR] Frame ${i + 1}/${files.length} (${file})`);
      const { data: { text } } = await worker.recognize(filePath);
      const cleaned = text.trim();
      if (cleaned) {
        results.push(cleaned);
      }
    } catch (err: any) {
      console.error(`[OCR ERROR] Failed on frame ${file}:`, err.message);
    }
  }

  await worker.terminate();
  return results.join('\n');
}
