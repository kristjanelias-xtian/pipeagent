import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const pool = new pg.Pool({
      host: process.env.PG_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
      port: Number(process.env.PG_PORT) || 5432,
      database: process.env.PG_DATABASE || 'postgres',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
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
