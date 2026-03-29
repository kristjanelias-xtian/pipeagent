import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const connString = process.env.DATABASE_URL;
    if (!connString) throw new Error('Missing DATABASE_URL');
    // Strip sslmode from URL (we configure SSL via pool options)
    const cleanConnString = connString.replace(/[?&]sslmode=[^&]*/g, '');
    const pool = new pg.Pool({
      connectionString: cleanConnString,
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
