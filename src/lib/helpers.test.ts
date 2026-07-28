import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanAndFilterText } from '../pipeline/filter';
import { parseTags, serializeTags, formatDuration, truncatePath } from '../lib/format';
import { rankVideos, scoreVideo } from '../lib/search';
import type { Video } from '../db/schema';

function fakeVideo(partial: Partial<Video>): Video {
  return {
    id: 1,
    filePath: 'demo.mp4',
    fileHash: 'abc',
    duration: 12,
    audioExtracted: true,
    framesExtracted: true,
    ocrText: null,
    ocrStatus: 'done',
    transcription: null,
    transcriptionStatus: 'done',
    cleanedText: null,
    tags: null,
    taggingStatus: 'done',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe('cleanAndFilterText', () => {
  it('strips urls mentions and hashtags', () => {
    const out = cleanAndFilterText(
      'Learn React https://example.com @user #fyp today',
      ''
    );
    assert.match(out, /Learn/);
    assert.match(out, /React/);
    assert.doesNotMatch(out, /example\.com/);
    assert.doesNotMatch(out, /@user/);
    assert.doesNotMatch(out, /#fyp/);
  });

  it('keeps short acronyms and dedupes lines', () => {
    const out = cleanAndFilterText('Use AI tools\nUse AI tools\nGo fast', '');
    assert.match(out, /AI/);
    assert.equal(out.split('\n').length, 2);
  });
});

describe('tags helpers', () => {
  it('parses and serializes tags', () => {
    const tags = ['python', 'machine-learning'];
    assert.deepEqual(parseTags(serializeTags(tags)), tags);
    assert.deepEqual(parseTags('not-json'), []);
    assert.deepEqual(parseTags(null), []);
  });
});

describe('format helpers', () => {
  it('formats duration and truncates paths', () => {
    assert.equal(formatDuration(125), '2:05');
    assert.equal(formatDuration(null), 'N/A');
    assert.equal(truncatePath('short.mp4'), 'short.mp4');
    assert.ok(truncatePath('a'.repeat(50), 10).startsWith('...'));
  });
});

describe('search ranking', () => {
  it('ranks exact tag matches higher than text matches', () => {
    const tagHit = fakeVideo({
      id: 1,
      tags: serializeTags(['python', 'django']),
      cleanedText: 'hello world',
      filePath: 'other.mp4',
    });
    const textHit = fakeVideo({
      id: 2,
      tags: serializeTags(['cooking']),
      cleanedText: 'python tutorial basics',
      filePath: 'food.mp4',
    });

    assert.ok(scoreVideo(tagHit, 'python') > scoreVideo(textHit, 'python'));

    const ranked = rankVideos([textHit, tagHit], 'python');
    assert.equal(ranked[0].id, 1);
  });

  it('returns empty when nothing matches', () => {
    const video = fakeVideo({ tags: '["react"]', cleanedText: 'hooks' });
    assert.deepEqual(rankVideos([video], 'golang'), []);
  });
});
