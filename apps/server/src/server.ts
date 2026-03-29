import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { auth } from './routes/auth.js';
import webhooks from './routes/webhooks.js';
import chat from './routes/chat.js';
import seed from './routes/seed.js';
import leads from './routes/leads.js';
import settings from './routes/settings.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/auth', auth);
app.route('/webhooks', webhooks);

app.use('/*', authMiddleware);

app.route('/chat', chat);
app.route('/seed', seed);
app.route('/leads', leads);
app.route('/settings', settings);

// In production, serve the frontend static files
const __dirname = dirname(fileURLToPath(import.meta.url));
const staticRoot = resolve(__dirname, '../../../apps/web/dist');
if (existsSync(staticRoot)) {
  console.log(`Serving frontend from ${staticRoot}`);

  // Serve static assets
  app.get('/*', async (c, next) => {
    const filePath = join(staticRoot, c.req.path);
    if (existsSync(filePath) && !filePath.endsWith('/')) {
      const { readFile } = await import('fs/promises');
      const { readFile: rf } = await import('fs/promises');
      const content = await rf(filePath);
      const ext = filePath.split('.').pop() ?? '';
      const mimeTypes: Record<string, string> = {
        html: 'text/html', js: 'application/javascript', css: 'text/css',
        json: 'application/json', png: 'image/png', jpg: 'image/jpeg',
        svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2',
      };
      c.header('Content-Type', mimeTypes[ext] ?? 'application/octet-stream');
      return c.body(new Uint8Array(content));
    }
    await next();
  });

  // SPA fallback: serve index.html for non-API routes
  app.get('*', async (c) => {
    const { readFile } = await import('fs/promises');
    const html = await readFile(join(staticRoot, 'index.html'), 'utf-8');
    return c.html(html);
  });
}

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
