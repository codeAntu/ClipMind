import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config();

import { db, runMigrations } from './db';
import { videos } from './db/schema';
import { extractMedia, getPaths, cleanupMediaCache } from './pipeline/extractor';
import { performOCR } from './pipeline/ocr';
import { transcribeAudio } from './pipeline/transcribe';
import { cleanAndFilterText } from './pipeline/filter';
import { generateTags } from './pipeline/tagger';

// Supported video extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv'];

// Config values
const VIDEOS_DIR = path.resolve(process.cwd(), 'videos');
const OCR_INTERVAL = parseInt(process.env.OCR_INTERVAL_SECONDS || '2', 10);
const DELETE_CACHE = process.env.DELETE_CACHE_AFTER_PROCESSING !== 'false'; // defaults to true

/**
 * Computes a quick hash of the video file based on its path, size, and mtime
 */
function getFileHash(filePath: string): string {
  const stats = fs.statSync(filePath);
  const inputString = `${filePath}:${stats.size}:${stats.mtimeMs}`;
  return crypto.createHash('md5').update(inputString).digest('hex');
}

/**
 * Recursively scans directory for video files
 */
function scanVideos(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    console.warn(`Videos directory not found at: ${dir}. Creating it...`);
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.startsWith('.')) continue; // skip hidden files

    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanVideos(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (VIDEO_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function main() {
  console.log('=== starting ClipMind Pipeline ===');
  
  // Ensure database migrations have run
  runMigrations();

  // Basic API key validation
  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY is not defined in the environment.');
    console.error('Please configure it in the .env file before running.');
    process.exit(1);
  }

  // Scan videos
  console.log(`Scanning directory: ${VIDEOS_DIR}`);
  const videoFiles = scanVideos(VIDEOS_DIR);
  console.log(`Found ${videoFiles.length} video files to process.`);

  for (let i = 0; i < videoFiles.length; i++) {
    const absoluteVideoPath = videoFiles[i];
    // Store relative path in database for portability
    const relativeVideoPath = path.relative(VIDEOS_DIR, absoluteVideoPath);
    const fileHash = getFileHash(absoluteVideoPath);
    
    console.log(`\n----------------------------------------`);
    console.log(`Processing Video [${i + 1}/${videoFiles.length}]: ${relativeVideoPath}`);
    console.log(`Hash: ${fileHash}`);

    // Check if record exists in database
    let [videoRecord] = db.select().from(videos).where(eq(videos.fileHash, fileHash)).all();

    if (videoRecord) {
      if (videoRecord.taggingStatus === 'done') {
        let isApiFailed = false;
        try {
          const parsed = JSON.parse(videoRecord.tags || '[]');
          isApiFailed = Array.isArray(parsed) && parsed.includes('api-failed');
        } catch (_) {}

        if (!isApiFailed) {
          console.log(`[Cache] Video fully processed previously. Tags: ${videoRecord.tags}. Skipping.`);
          continue;
        } else {
          console.log(`[Cache] Video had fallback tags ("api-failed"). Retrying tagging step...`);
          videoRecord.taggingStatus = 'pending';
        }
      }
      console.log(`[Cache] Found incomplete processing record. Resuming progress...`);
    } else {
      console.log(`Creating database entry for new video...`);
      const now = new Date();
      [videoRecord] = db.insert(videos).values({
        filePath: relativeVideoPath,
        fileHash: fileHash,
        audioExtracted: false,
        framesExtracted: false,
        ocrStatus: 'pending',
        transcriptionStatus: 'pending',
        taggingStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      }).returning().all();
    }

    try {
      // Setup folders
      const { framesDir, audioPath } = getPaths(fileHash);

      // --- STEP 1: Extraction ---
      if (!videoRecord.audioExtracted || !videoRecord.framesExtracted) {
        console.log('[Step 1] Extracting media components...');
        const extracted = await extractMedia(absoluteVideoPath, fileHash, OCR_INTERVAL);
        
        db.update(videos)
          .set({
            audioExtracted: !!extracted.audioPath,
            framesExtracted: true,
            duration: extracted.duration,
            updatedAt: new Date(),
          })
          .where(eq(videos.fileHash, fileHash))
          .run();

        // Refresh record
        videoRecord.audioExtracted = !!extracted.audioPath;
        videoRecord.framesExtracted = true;
        videoRecord.duration = extracted.duration;
      } else {
        console.log('[Step 1 Cache] Media components already extracted.');
      }

      // --- STEP 2: OCR ---
      if (videoRecord.ocrStatus !== 'done') {
        console.log('[Step 2] Extracting text from video frames (OCR)...');
        db.update(videos).set({ ocrStatus: 'processing' }).where(eq(videos.fileHash, fileHash)).run();
        
        try {
          const ocrText = await performOCR(framesDir);
          db.update(videos)
            .set({
              ocrText: ocrText,
              ocrStatus: 'done',
              updatedAt: new Date(),
            })
            .where(eq(videos.fileHash, fileHash))
            .run();
          
          videoRecord.ocrText = ocrText;
          videoRecord.ocrStatus = 'done';
          console.log(`\n[OCR Output] Extracted raw text from frames:\n---\n${ocrText || '(No text detected)'}\n---\n`);
        } catch (ocrErr: any) {
          db.update(videos).set({ ocrStatus: 'failed' }).where(eq(videos.fileHash, fileHash)).run();
          throw ocrErr;
        }
      } else {
        console.log('[Step 2 Cache] OCR already completed.');
        console.log(`\n[OCR Output (Cached)]:\n---\n${videoRecord.ocrText || '(No text detected)'}\n---\n`);
      }

      // --- STEP 3: Whisper Transcription ---
      if (videoRecord.transcriptionStatus !== 'done') {
        console.log('[Step 3] Transcribing video audio (Whisper)...');
        db.update(videos).set({ transcriptionStatus: 'processing' }).where(eq(videos.fileHash, fileHash)).run();

        try {
          // Resolve exact audio path
          const actualAudioPath = videoRecord.audioExtracted ? audioPath : '';
          const transcription = await transcribeAudio(actualAudioPath, fileHash);
          
          db.update(videos)
            .set({
              transcription: transcription,
              transcriptionStatus: 'done',
              updatedAt: new Date(),
            })
            .where(eq(videos.fileHash, fileHash))
            .run();

          videoRecord.transcription = transcription;
          videoRecord.transcriptionStatus = 'done';
          console.log(`\n[Whisper Output] Transcribed audio text:\n---\n${transcription || '(No speech detected)'}\n---\n`);
        } catch (whisperErr: any) {
          db.update(videos).set({ transcriptionStatus: 'failed' }).where(eq(videos.fileHash, fileHash)).run();
          throw whisperErr;
        }
      } else {
        console.log('[Step 3 Cache] Audio transcription already completed.');
        console.log(`\n[Whisper Output (Cached)]:\n---\n${videoRecord.transcription || '(No speech detected)'}\n---\n`);
      }

      // --- STEP 4: Filtering & Cleaning ---
      console.log('[Step 4] Filtering and merging text corpora...');
      const cleanedText = cleanAndFilterText(videoRecord.ocrText || '', videoRecord.transcription || '');
      db.update(videos)
        .set({
          cleanedText: cleanedText,
          updatedAt: new Date(),
        })
        .where(eq(videos.fileHash, fileHash))
        .run();
      videoRecord.cleanedText = cleanedText;
      console.log(`\n[Filter Output] Cleaned text to be sent to Gemini:\n---\n${cleanedText || '(Corpus is empty)'}\n---\n`);

      // --- STEP 5: Gemini Tag Generation ---
      if (videoRecord.taggingStatus !== 'done') {
        console.log('[Step 5] Generating searchable tags via Gemini AI...');
        db.update(videos).set({ taggingStatus: 'processing' }).where(eq(videos.fileHash, fileHash)).run();

        try {
          const tags = await generateTags(videoRecord.cleanedText || '');
          db.update(videos)
            .set({
              tags: JSON.stringify(tags),
              taggingStatus: 'done',
              updatedAt: new Date(),
            })
            .where(eq(videos.fileHash, fileHash))
            .run();
          
          videoRecord.tags = JSON.stringify(tags);
          videoRecord.taggingStatus = 'done';
          console.log(`\n[Tagger Output] Gemini tags generated:\n---\n${JSON.stringify(tags)}\n---\n`);
        } catch (geminiErr: any) {
          db.update(videos).set({ taggingStatus: 'failed' }).where(eq(videos.fileHash, fileHash)).run();
          throw geminiErr;
        }
      } else {
        console.log('[Step 5 Cache] Gemini tags already generated.');
        console.log(`\n[Tagger Output (Cached)]:\n---\n${videoRecord.tags}\n---\n`);
      }

      // --- STEP 6: Cache Cleanup ---
      if (DELETE_CACHE) {
        console.log('[Step 6] Cleaning up temporary frame/audio files...');
        cleanupMediaCache(fileHash);
      }

      console.log(`Video processing complete: ${relativeVideoPath}`);

    } catch (err: any) {
      console.error(`ERROR processing video ${relativeVideoPath}:`, err.message);
      // Continue to next video in the loop rather than crashing the whole process
    }
  }

  console.log('\n=== ClipMind Pipeline Execution Finished ===');
}

main().catch(err => {
  console.error('Pipeline crashed with critical error:', err);
  process.exit(1);
});
