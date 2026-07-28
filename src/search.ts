import { ensureSchema } from './db';
import { listTagRows, searchVideos } from './db/videos';
import { formatDuration, parseTags, truncatePath } from './lib/format';

function printTagInventory() {
  console.log('Usage: npm run search -- "<query>"');
  console.log('Example: npm run search -- "python"\n');
  console.log('--- Available Tags ---');

  const counts = new Map<string, number>();
  for (const row of listTagRows()) {
    for (const tag of parseTags(row.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    console.log('No tags yet. Process videos first.');
    return;
  }

  for (const [tag, count] of sorted) {
    console.log(`- ${tag.padEnd(25)} (${count})`);
  }
}

function printResults(query: string) {
  const results = searchVideos(query);
  console.log(`Search: "${query}" — ${results.length} result(s)\n`);
  if (results.length === 0) return;

  const line = '-'.repeat(100);
  console.log(line);
  console.log(
    'ID'.padEnd(5) + ' | ' +
    'Duration'.padEnd(8) + ' | ' +
    'Path'.padEnd(40) + ' | ' +
    'Tags'
  );
  console.log(line);

  for (const row of results) {
    console.log(
      String(row.id).padEnd(5) + ' | ' +
      formatDuration(row.duration).padEnd(8) + ' | ' +
      truncatePath(row.filePath).padEnd(40) + ' | ' +
      parseTags(row.tags).join(', ')
    );
  }

  console.log(line);
}

ensureSchema();

const query = process.argv.slice(2).join(' ').trim();
if (query) printResults(query);
else printTagInventory();
