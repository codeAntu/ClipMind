import type { Video } from '../db/schema';
import { formatDuration, parseTags, truncatePath } from '../lib/format';
import { mediaUrl } from './media';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const styles = `
:root {
  --bg: #f3efe6;
  --ink: #1c1917;
  --muted: #78716c;
  --line: #d6d3d1;
  --accent: #0f766e;
  --panel: #fffcf7;
  --chip: #e7e5e4;
  --overlay: rgba(12, 10, 9, 0.92);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "IBM Plex Sans", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, #faf6ee 0%, transparent 45%),
    linear-gradient(180deg, #f7f3eb 0%, var(--bg) 100%);
  min-height: 100vh;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
.brand {
  font-family: Georgia, "Iowan Old Style", serif;
  font-size: 1.85rem;
  letter-spacing: -0.02em;
  margin: 0 0 0.2rem;
}
.sub { color: var(--muted); margin: 0 0 1rem; }
.search {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.search input {
  flex: 1;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
  font-size: 1rem;
}
.search button {
  border: 0;
  background: var(--accent);
  color: white;
  border-radius: 8px;
  padding: 0 1rem;
  font-weight: 600;
  cursor: pointer;
}
.meta { color: var(--muted); margin-bottom: 1rem; }
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}
@media (max-width: 900px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px) {
  .grid { grid-template-columns: 1fr; }
}
.tile {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font: inherit;
  color: inherit;
  display: flex;
  flex-direction: column;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(28, 25, 23, 0.08);
}
.thumb {
  position: relative;
  aspect-ratio: 9 / 16;
  background: #1c1917;
  overflow: hidden;
}
.thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.badge {
  position: absolute;
  right: 0.4rem;
  bottom: 0.4rem;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.tile-body { padding: 0.55rem 0.6rem 0.7rem; }
.tile-title {
  font-size: 0.78rem;
  line-height: 1.3;
  margin: 0 0 0.35rem;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tile-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.tile-tags span {
  background: var(--chip);
  border-radius: 999px;
  padding: 0.1rem 0.4rem;
  font-size: 0.68rem;
  color: #44403c;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty { color: var(--muted); padding: 2rem 0; }
.back { display: inline-block; margin-bottom: 1rem; }
.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem;
}
.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}
.status { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.75rem; }
.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
.tag {
  display: inline-block;
  background: var(--chip);
  color: var(--ink);
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.85rem;
}
.text-block {
  white-space: pre-wrap;
  background: #f5f5f4;
  border-radius: 8px;
  padding: 0.85rem;
  font-size: 0.92rem;
  line-height: 1.45;
  color: #44403c;
}
.detail-layout {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
  align-items: start;
}
@media (max-width: 800px) {
  .detail-layout { grid-template-columns: 1fr; }
}
.detail-video {
  width: 100%;
  max-height: 80vh;
  background: #111;
  border-radius: 8px;
}

/* Fullscreen: video left, info right */
.fs {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: none;
  align-items: stretch;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
}
.fs.open { display: flex; }
.fs-panel {
  width: min(1100px, 100%);
  max-height: 96vh;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 1rem;
  background: #1c1917;
  border-radius: 14px;
  padding: 1rem;
  overflow: hidden;
}
@media (max-width: 800px) {
  .fs-panel {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}
.fs-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.fs-left video {
  width: 100%;
  height: 100%;
  max-height: calc(96vh - 2rem);
  object-fit: contain;
  background: #000;
  border-radius: 10px;
}
.fs-right {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  color: #fafaf9;
  overflow: auto;
}
.fs-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.fs-title {
  font-size: 0.92rem;
  word-break: break-all;
  line-height: 1.35;
  opacity: 0.95;
}
.fs-close {
  border: 0;
  background: #44403c;
  color: #fff;
  border-radius: 999px;
  width: 2.2rem;
  height: 2.2rem;
  font-size: 1.2rem;
  cursor: pointer;
  flex-shrink: 0;
}
.fs-meta {
  color: #a8a29e;
  font-size: 0.85rem;
}
.fs-label {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a8a29e;
}
.fs-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.fs-tags a {
  background: #292524;
  color: #e7e5e4;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.78rem;
}
.fs-text {
  flex: 1;
  white-space: pre-wrap;
  background: #292524;
  border-radius: 8px;
  padding: 0.85rem;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #e7e5e4;
  overflow: auto;
  max-height: 50vh;
}
.fs-link { color: #5eead4; font-size: 0.85rem; }
body.fs-lock { overflow: hidden; }
`;

const script = `
(function () {
  const fs = document.getElementById('fs');
  if (!fs) return;
  const video = document.getElementById('fs-video');
  const title = document.getElementById('fs-title');
  const meta = document.getElementById('fs-meta');
  const tags = document.getElementById('fs-tags');
  const textEl = document.getElementById('fs-text');
  const link = document.getElementById('fs-link');
  const closeBtn = document.getElementById('fs-close');

  function decodeData(value) {
    try { return decodeURIComponent(value || ''); } catch (_) { return value || ''; }
  }

  function openFromTile(tile) {
    title.textContent = tile.dataset.title || '';
    meta.textContent = [
      tile.dataset.id ? '#' + tile.dataset.id : '',
      tile.dataset.duration || '',
      tile.dataset.status || ''
    ].filter(Boolean).join(' · ');

    tags.innerHTML = '';
    try {
      const list = JSON.parse(tile.dataset.tags || '[]');
      list.forEach(function (tag) {
        const a = document.createElement('a');
        a.href = '/?q=' + encodeURIComponent(tag);
        a.textContent = tag;
        tags.appendChild(a);
      });
    } catch (_) {}

    const extracted = decodeData(tile.dataset.text).trim();
    textEl.textContent = extracted || '(no extracted text)';
    link.href = '/video/' + tile.dataset.id;
    video.src = tile.dataset.src;
    fs.classList.add('open');
    document.body.classList.add('fs-lock');
    video.play().catch(function () {});
  }

  function closeFs() {
    fs.classList.remove('open');
    document.body.classList.remove('fs-lock');
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  document.querySelectorAll('.tile').forEach(function (tile) {
    tile.addEventListener('click', function () { openFromTile(tile); });
  });

  closeBtn.addEventListener('click', closeFs);
  fs.addEventListener('click', function (e) {
    if (e.target === fs) closeFs();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeFs();
  });
})();
`;

function layout(title: string, body: string, withScript = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="wrap">
    ${body}
  </div>
  ${withScript ? fullscreenMarkup() + `<script>${script}</script>` : ''}
</body>
</html>`;
}

function fullscreenMarkup() {
  return `
  <div class="fs" id="fs" aria-hidden="true">
    <div class="fs-panel">
      <div class="fs-left">
        <video id="fs-video" controls playsinline></video>
      </div>
      <div class="fs-right">
        <div class="fs-top">
          <div class="fs-title" id="fs-title"></div>
          <button type="button" class="fs-close" id="fs-close" aria-label="Close">×</button>
        </div>
        <div class="fs-meta" id="fs-meta"></div>
        <p class="fs-label">Tags</p>
        <div class="fs-tags" id="fs-tags"></div>
        <p class="fs-label">Extracted text</p>
        <div class="fs-text" id="fs-text"></div>
        <a class="fs-link" id="fs-link" href="#">Open details →</a>
      </div>
    </div>
  </div>`;
}

function searchForm(query: string) {
  return `
    <form class="search" method="get" action="/">
      <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search tags, text, filename..." autofocus />
      <button type="submit">Search</button>
    </form>
  `;
}

function tagsHtml(tags: string[]) {
  if (tags.length === 0) return `<span class="meta">No tags</span>`;
  return `<div class="tags">${tags
    .map(
      (tag) =>
        `<a class="tag" href="/?q=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`
    )
    .join('')}</div>`;
}

function gridTile(video: Video) {
  const tags = parseTags(video.tags);
  const src = mediaUrl(video.filePath);
  const title = truncatePath(video.filePath, 48);
  const shown = tags.slice(0, 3);
  const text = video.text || '';

  return `
    <button
      type="button"
      class="tile"
      data-id="${video.id}"
      data-src="${escapeHtml(src)}"
      data-title="${escapeHtml(video.filePath)}"
      data-duration="${escapeHtml(formatDuration(video.duration))}"
      data-status="${escapeHtml(video.status)}"
      data-tags='${escapeHtml(JSON.stringify(tags))}'
      data-text="${escapeHtml(encodeURIComponent(text))}"
    >
      <div class="thumb">
        <video muted preload="metadata" src="${escapeHtml(src)}#t=0.1"></video>
        <span class="badge">${escapeHtml(formatDuration(video.duration))}</span>
      </div>
      <div class="tile-body">
        <p class="tile-title">${escapeHtml(title)}</p>
        <div class="tile-tags">
          ${shown.map((t) => `<span>${escapeHtml(t)}</span>`).join('') || '<span>no tags</span>'}
        </div>
      </div>
    </button>
  `;
}

export function renderHome(query: string, results: Video[]) {
  const heading = query
    ? `${results.length} result(s) for “${escapeHtml(query)}”`
    : `${results.length} video(s)`;

  const list =
    results.length === 0
      ? `<p class="empty">No videos found. Process some reels first, or try another search.</p>`
      : `<div class="grid">${results.map(gridTile).join('\n')}</div>`;

  const body = `
    <h1 class="brand">ClipMind</h1>
    <p class="sub">Local reel browser — click a tile for fullscreen</p>
    ${searchForm(query)}
    <p class="meta">${heading}</p>
    ${list}
  `;

  return layout(query ? `Search: ${query}` : 'ClipMind', body, true);
}

export function renderDetail(video: Video) {
  const tags = parseTags(video.tags);
  const src = mediaUrl(video.filePath);
  const text = video.text?.trim() || '(no extracted text)';

  const body = `
    <a class="back" href="/">← All videos</a>
    <h1 class="brand">ClipMind</h1>
    <p class="sub">${escapeHtml(video.filePath)}</p>
    ${searchForm('')}
    <article class="card">
      <div class="row-meta">
        <span>#${video.id}</span>
        <span>${escapeHtml(formatDuration(video.duration))}</span>
        <span class="status">${escapeHtml(video.status)}</span>
      </div>
      <div class="detail-layout">
        <video class="detail-video" controls preload="metadata" src="${escapeHtml(src)}"></video>
        <div>
          <h2>Tags</h2>
          ${tagsHtml(tags)}
          <h2 style="margin-top:1rem">Extracted text</h2>
          <div class="text-block">${escapeHtml(text)}</div>
        </div>
      </div>
    </article>
  `;

  return layout(video.filePath, body, false);
}

export function renderNotFound(message: string) {
  return layout(
    'Not found',
    `<a class="back" href="/">← All videos</a><p class="empty">${escapeHtml(message)}</p>`,
    false
  );
}
