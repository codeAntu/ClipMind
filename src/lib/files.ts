import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function scanVideos(dir = config.videosDir): string[] {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.warn(`Created empty videos directory: ${dir}`);
    return [];
  }

  const results: string[] = [];

  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;

    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanVideos(fullPath));
      continue;
    }

    if (config.videoExtensions.has(path.extname(name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}
