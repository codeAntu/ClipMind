import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export function getFileHash(filePath: string): string {
  const { size, mtimeMs } = fs.statSync(filePath);
  return crypto
    .createHash('md5')
    .update(`${filePath}:${size}:${mtimeMs}`)
    .digest('hex');
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
