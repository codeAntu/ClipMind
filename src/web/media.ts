import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
};

/** Build a browser URL for a relative video path stored in the DB. */
export function mediaUrl(filePath: string): string {
  const encoded = filePath
    .split(/[/\\]/)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/media/${encoded}`;
}

/**
 * Resolve a /media/... request path to an absolute file under videosDir.
 * Returns null if the path escapes the videos directory or does not exist.
 */
export function resolveMediaPath(urlPath: string): string | null {
  const decoded = urlPath
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part))
    .join(path.sep);

  const root = path.resolve(config.videosDir);
  const absolute = path.resolve(root, decoded);

  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return null;
  }

  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return null;
  }

  return absolute;
}

export function mediaContentType(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export type RangeResult =
  | { kind: 'full'; size: number; type: string; stream: fs.ReadStream }
  | { kind: 'partial'; size: number; type: string; start: number; end: number; stream: fs.ReadStream }
  | { kind: 'unsatisfiable'; size: number };

export function openMediaStream(
  absolutePath: string,
  rangeHeader: string | undefined
): RangeResult {
  const size = fs.statSync(absolutePath).size;
  const type = mediaContentType(absolutePath);

  if (!rangeHeader) {
    return {
      kind: 'full',
      size,
      type,
      stream: fs.createReadStream(absolutePath),
    };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return {
      kind: 'full',
      size,
      type,
      stream: fs.createReadStream(absolutePath),
    };
  }

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return { kind: 'unsatisfiable', size };
  }

  end = Math.min(end, size - 1);

  return {
    kind: 'partial',
    size,
    type,
    start,
    end,
    stream: fs.createReadStream(absolutePath, { start, end }),
  };
}
