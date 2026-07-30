import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { ensureSchema } from '../db';
import { findById, listAllVideos, searchVideos } from '../db/videos';
import { openMediaStream, resolveMediaPath } from './media';
import { renderDetail, renderHome, renderNotFound } from './views';

ensureSchema();

export const app = new Hono();

app.get('/', (c) => {
  const q = (c.req.query('q') || '').trim();
  const results = q ? searchVideos(q) : listAllVideos();
  return c.html(renderHome(q, results));
});

app.get('/video/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.html(renderNotFound('Invalid video id.'), 400);
  }

  const video = findById(id);
  if (!video) {
    return c.html(renderNotFound('Video not found.'), 404);
  }

  return c.html(renderDetail(video));
});

app.get('/media/*', (c) => {
  const wildcard = c.req.path.replace(/^\/media\/?/, '');
  const absolute = resolveMediaPath(wildcard);

  if (!absolute) {
    return c.text('Media not found', 404);
  }

  const result = openMediaStream(absolute, c.req.header('range'));

  if (result.kind === 'unsatisfiable') {
    c.header('Content-Range', `bytes */${result.size}`);
    return c.body(null, 416);
  }

  if (result.kind === 'partial') {
    const { start, end, size, type, stream: fileStream } = result;
    c.status(206);
    c.header('Content-Type', type);
    c.header('Accept-Ranges', 'bytes');
    c.header('Content-Range', `bytes ${start}-${end}/${size}`);
    c.header('Content-Length', String(end - start + 1));

    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk);
      }
    });
  }

  c.header('Content-Type', result.type);
  c.header('Accept-Ranges', 'bytes');
  c.header('Content-Length', String(result.size));

  return stream(c, async (s) => {
    for await (const chunk of result.stream) {
      await s.write(chunk);
    }
  });
});
