import { GoogleGenAI, Type } from '@google/genai';

export async function generateTags(cleanedText: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please add it to your .env file.');
  }

  // Initialize the Google Gen AI client
  const ai = new GoogleGenAI({ apiKey });

  if (!cleanedText || cleanedText.trim().length === 0) {
    console.log('[Tagger] Cleaned text is empty. Returning fallback tags.');
    return ['untagged', 'silent-video'];
  }

  console.log(`[Tagger] Requesting tags from Gemini 1.5 Flash (input text size: ${cleanedText.length} chars)...`);

  const prompt = `
Generate 5-10 highly relevant, specific, and searchable tags based on the following text content extracted from a short video via OCR and audio transcription.

Requirements:
1. Tags must be in lowercase.
2. Tags containing multiple words should be hyphenated (e.g. "web-development", "react-tutorial").
3. Do NOT output generic tags (e.g. "video", "shorts", "text", "short-video", "tutorial").
4. Target key concepts, technologies, programming languages, products, APIs, or core topics mentioned or shown in the video.

Text Content:
"""
${cleanedText}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: 'List of 5 to 10 search tags.'
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini API.');
    }

    const tags = JSON.parse(responseText.trim());
    if (Array.isArray(tags)) {
      const normalizedTags = tags
        .map((t: string) => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t !== 'shorts' && t !== 'video');
      console.log(`[Tagger] Successfully generated ${normalizedTags.length} tags: [${normalizedTags.join(', ')}]`);
      return normalizedTags;
    }

    throw new Error('API returned JSON that was not a string array.');
  } catch (err: any) {
    console.error('[Tagger Error] Gemini tagging failed:', err.message);
    // Return a fallback tag so the pipeline doesn't break entirely if the API is down or throttled
    console.warn('[Tagger] Using fallback tags due to API failure.');
    return ['untagged', 'api-failed'];
  }
}
