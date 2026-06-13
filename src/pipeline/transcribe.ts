import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function transcribeAudio(audioPath: string, fileHash: string): Promise<string> {
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.log(`[Whisper] No audio track available for hash ${fileHash}. Skipping transcription.`);
    return '';
  }

  // Model configured via env or default to 'base'
  const model = process.env.WHISPER_MODEL || 'base';
  
  // Set up temp directory for Whisper output
  const outputDir = path.resolve(process.cwd(), '.cache', 'transcripts', fileHash);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioFileName = path.basename(audioPath, '.wav'); // e.g. [fileHash]
  const expectedTxtFile = path.join(outputDir, `${audioFileName}.txt`);

  // If already transcribed and stored in cache directory, we can read it directly
  if (fs.existsSync(expectedTxtFile)) {
    console.log(`[Whisper] Found cached transcription file: ${expectedTxtFile}`);
    return fs.readFileSync(expectedTxtFile, 'utf8').trim();
  }

  console.log(`[Whisper] Transcribing ${audioPath} using Whisper model "${model}"...`);

  // Build command: whisper <audio> --model <model> --output_dir <dir> --output_format txt
  // We specify --language en if we assume mostly English or auto-detect
  const command = `whisper "${audioPath}" --model ${model} --output_dir "${outputDir}" --output_format txt`;

  await new Promise<void>((resolve, reject) => {
    // Large timeout for transcription on slower CPUs
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Whisper Error] CLI command failed: ${error.message}`);
        console.error(`[Whisper Error details] Stderr: ${stderr}`);
        return reject(error);
      }
      resolve();
    });
  });

  if (fs.existsSync(expectedTxtFile)) {
    const text = fs.readFileSync(expectedTxtFile, 'utf8').trim();
    // Clean up transcription file after reading
    try {
      fs.unlinkSync(expectedTxtFile);
      fs.rmdirSync(outputDir);
    } catch (_) {}
    return text;
  }

  throw new Error(`Whisper completed but transcription file was not found at ${expectedTxtFile}`);
}
