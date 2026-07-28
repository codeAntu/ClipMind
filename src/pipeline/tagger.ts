import { GoogleGenAI, Type } from '@google/genai';
import { config, requireGeminiApiKey } from '../config';

const SKIP = new Set(['shorts', 'video']);

let client: GoogleGenAI | null = null;

function getClient() {
  return (client ??= new GoogleGenAI({ apiKey: requireGeminiApiKey() }));
}

const PROMPT = (text: string) => `
Generate 5-10 highly relevant, specific, searchable tags from this video text (OCR + transcript).

Rules:
- lowercase only
- multi-word tags use hyphens (e.g. web-development)
- no generic tags like video, shorts, text, tutorial
- focus on concepts, tech, languages, products, topics

Text:
"""
${text}
"""
`.trim();

export async function generateTags(cleanedText: string): Promise<string[]> {
  if (!cleanedText.trim()) return ['untagged', 'silent-video'];

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: PROMPT(cleanedText),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  if (!response.text) throw new Error('Empty response from Gemini.');

  const parsed = JSON.parse(response.text.trim());
  if (!Array.isArray(parsed)) throw new Error('Gemini did not return a tag array.');

  return parsed
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !SKIP.has(t));
}
