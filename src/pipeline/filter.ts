/**
 * Cleans and deduplicates text extracted from OCR and transcription.
 */
export function cleanAndFilterText(ocrText: string, transcription: string): string {
  // Combine OCR text and audio transcription
  const rawCombined = `${ocrText || ''}\n${transcription || ''}`;
  
  // Split into lines
  const lines = rawCombined.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    let cleaned = line;
    
    // 1. Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');
    cleaned = cleaned.replace(/www\.[^\s]+/gi, '');
    
    // 2. Remove @usernames (e.g. @john_doe, @tiktok_user.123)
    cleaned = cleaned.replace(/@[\w.]+/g, '');

    // 3. Remove #hashtags (e.g. #fyp, #coding)
    cleaned = cleaned.replace(/#\w+/g, '');

    // 4. Split line into words and remove short noise words (< 3 chars)
    // We preserve numbers and uppercase acronyms (e.g., "AI", "UI", "JS", "DB", "C#")
    const words = cleaned.split(/\s+/);
    const filteredWords = words.filter(word => {
      const cleanWord = word.replace(/[^a-zA-Z0-9#+]/g, ''); // strip punctuation for length check
      if (cleanWord.length >= 3) return true;
      // Keep uppercase acronyms (e.g. "AI", "JS", "C", "Go") or numbers
      if (/^[A-Z0-9+#]+$/.test(cleanWord) && cleanWord.length > 0) return true;
      return false;
    });

    cleaned = filteredWords.join(' ').trim();
    if (cleaned) {
      cleanedLines.push(cleaned);
    }
  }

  // 5. Remove duplicates (fuzzy line-level deduplication)
  const seen = new Set<string>();
  const uniqueLines: string[] = [];
  
  for (const line of cleanedLines) {
    // Normalize line for duplicate checking: lowercase and remove non-alphanumeric chars
    const normalized = line.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.length === 0) continue;
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueLines.push(line);
    }
  }

  // 6. Join lines and cap text size to avoid excessive noise (e.g., 4000 characters max)
  return uniqueLines.join('\n').substring(0, 4000).trim();
}
