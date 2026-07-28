import * as path from 'path';
import { config, requireGeminiApiKey } from './config';
import { ensureSchema } from './db';
import { errorMessage } from './lib/errors';
import { scanVideos } from './lib/files';
import { processVideo } from './pipeline/runner';

async function main() {
  console.log('=== ClipMind ===');

  ensureSchema();
  requireGeminiApiKey();

  const files = scanVideos();
  console.log(`Found ${files.length} video(s) in ${config.videosDir}`);

  for (let i = 0; i < files.length; i++) {
    const absolutePath = files[i];
    const name = path.relative(config.videosDir, absolutePath);

    console.log(`\n----------------------------------------`);
    console.log(`[${i + 1}/${files.length}] ${name}`);

    try {
      await processVideo(absolutePath);
    } catch (err) {
      console.error(`Failed: ${name} — ${errorMessage(err)}`);
    }
  }

  console.log('\n=== Finished ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
