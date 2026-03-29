import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './routes/auth.js';
import webhooks from './routes/webhooks.js';
import chat from './routes/chat.js';
import seed from './routes/seed.js';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/auth', auth);
app.route('/webhooks', webhooks);
app.route('/chat', chat);
app.route('/seed', seed);

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
