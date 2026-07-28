export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === 'string')
      : [];
  } catch {
    return [];
  }
}

export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function truncatePath(filePath: string, max = 40): string {
  if (filePath.length <= max) return filePath;
  return '...' + filePath.slice(-(max - 3));
}
