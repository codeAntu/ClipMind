import { config } from '../config';

function cleanLine(line: string): string {
  const stripped = line
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/@[\w.]+/g, '')
    .replace(/#\w+/g, '');

  return stripped
    .split(/\s+/)
    .filter((word) => {
      const core = word.replace(/[^a-zA-Z0-9#+]/g, '');
      if (core.length >= 3) return true;
      return core.length > 0 && /^[A-Z0-9+#]+$/.test(core);
    })
    .join(' ')
    .trim();
}

export function cleanAndFilterText(ocrText: string, transcription: string): string {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const line of `${ocrText}\n${transcription}`.split(/\r?\n/)) {
    const cleaned = cleanLine(line);
    const key = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }

  return unique.join('\n').slice(0, config.maxCleanedTextLength).trim();
}
