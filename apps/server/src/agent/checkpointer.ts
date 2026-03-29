import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const connString = process.env.DATABASE_URL;
    if (!connString) throw new Error('Missing DATABASE_URL');
    // Parse postgresql:// URL using http:// trick (URL doesn't handle pg scheme)
    const url = new URL(connString.replace(/^postgresql:\/\//, 'http://'));
    const pool = new pg.Pool({
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });
    checkpointer = new PostgresSaver(pool);
    // Retry setup — Supabase free tier may need to wake up
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await checkpointer.setup();
        break;
      } catch (err) {
        console.error(`Checkpointer setup attempt ${attempt + 1} failed:`, err);
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  return checkpointer;
}
