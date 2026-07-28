import * as path from 'path';
import { config, requireGeminiApiKey } from './config';
import { ensureSchema } from './db';
import { errorMessage } from './lib/errors';
import { scanVideos } from './lib/files';
import { processVideo } from './pipeline/runner';

async function main() {
  ensureSchema();
  requireGeminiApiKey();

  const files = scanVideos();
  console.log(`ClipMind — ${files.length} video(s)\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const absolutePath = files[i];
    const name = path.relative(config.videosDir, absolutePath);
    const prefix = `[${i + 1}/${files.length}] ${name}`;

    try {
      const result = await processVideo(absolutePath);
      if (result === 'skipped') {
        skipped++;
        console.log(`${prefix} — skip`);
      } else {
        done++;
        console.log(`${prefix} — done`);
      }
    } catch (err) {
      failed++;
      console.error(`${prefix} — failed: ${errorMessage(err)}`);
    }
  }

  console.log(`\nFinished — ${done} done, ${skipped} skipped, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal:', errorMessage(err));
  process.exit(1);
});
