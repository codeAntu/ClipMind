import { serve } from '@hono/node-server';
import { app } from './app';

const port = Number(process.env.PORT || 3456);

console.log(`ClipMind UI → http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
