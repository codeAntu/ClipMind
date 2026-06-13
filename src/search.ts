import { db } from './db';
import { videos } from './db/schema';
import { like, or } from 'drizzle-orm';

/**
 * Formats duration from seconds to MM:SS format
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function search() {
  const query = process.argv.slice(2).join(' ').trim();

  if (!query) {
    console.log('Usage: npm run search -- "<query-string>"');
    console.log('Examples:');
    console.log('  npm run search -- "python"');
    console.log('  npm run search -- "machine learning"');
    console.log('\n--- Available Tags ---');

    // Retrieve all processed videos to collect unique tags
    const records = db.select({ tags: videos.tags }).from(videos).all();
    const tagCount: Record<string, number> = {};

    for (const record of records) {
      if (record.tags) {
        try {
          const parsedTags: string[] = JSON.parse(record.tags);
          for (const t of parsedTags) {
            tagCount[t] = (tagCount[t] || 0) + 1;
          }
        } catch (_) {}
      }
    }

    const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);

    if (sortedTags.length === 0) {
      console.log('No tags found in the database yet. Process some videos first.');
    } else {
      for (const [tag, count] of sortedTags) {
        console.log(`- ${tag.padEnd(25)} (${count} video${count === 1 ? '' : 's'})`);
      }
    }
    return;
  }

  console.log(`Searching database for: "${query}"...\n`);

  // Query database
  // Matches tag JSON string, cleaned text, or filename/filepath
  const results = db.select()
    .from(videos)
    .where(
      or(
        like(videos.tags, `%${query}%`),
        like(videos.cleanedText, `%${query}%`),
        like(videos.filePath, `%${query}%`)
      )
    )
    .all();

  if (results.length === 0) {
    console.log('No matching videos found.');
    return;
  }

  console.log(`Found ${results.length} matching video${results.length === 1 ? '' : 's'}:\n`);
  
  // Format table output
  console.log(''.padEnd(100, '-'));
  console.log(
    'ID'.padEnd(5) + ' | ' +
    'Duration'.padEnd(8) + ' | ' +
    'Video Path'.padEnd(40) + ' | ' +
    'Tags'
  );
  console.log(''.padEnd(100, '-'));

  for (const row of results) {
    let parsedTags: string[] = [];
    if (row.tags) {
      try {
        parsedTags = JSON.parse(row.tags);
      } catch (_) {}
    }

    const pathCol = row.filePath.length > 37 
      ? '...' + row.filePath.substring(row.filePath.length - 37) 
      : row.filePath;

    console.log(
      row.id.toString().padEnd(5) + ' | ' +
      formatDuration(row.duration).padEnd(8) + ' | ' +
      pathCol.padEnd(40) + ' | ' +
      parsedTags.join(', ')
    );
  }
  console.log(''.padEnd(100, '-'));
}

search().catch(err => {
  console.error('Search tool error:', err);
});
