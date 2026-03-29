import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
