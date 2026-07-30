import * as path from 'path';
import { requireGeminiApiKey } from './config';
import { ensureSchema } from './db';
import { errorMessage } from './lib/errors';
import { scanVideos } from './lib/files';
import { getTimingTotals, processVideo } from './pipeline/runner';

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

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
    const name = path.relative(
      path.resolve(process.cwd(), 'videos'),
      absolutePath
    );
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

  const { count, totals } = getTimingTotals();
  if (count > 0) {
    console.log('\nTiming totals (processed videos only):');
    console.log(`  extract  ${totals.extract}ms  (${pct(totals.extract, totals.total)})`);
    console.log(`  ocr      ${totals.ocr}ms  (${pct(totals.ocr, totals.total)})`);
    console.log(`  whisper  ${totals.whisper}ms  (${pct(totals.whisper, totals.total)})`);
    console.log(`  filter   ${totals.filter}ms  (${pct(totals.filter, totals.total)})`);
    console.log(`  gemini   ${totals.gemini}ms  (${pct(totals.gemini, totals.total)})`);
    console.log(`  total    ${totals.total}ms`);
  }
}

main().catch((err) => {
  console.error('Fatal:', errorMessage(err));
  process.exit(1);
});
