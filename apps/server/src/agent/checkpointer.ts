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
    });
    checkpointer = new PostgresSaver(pool);
    await checkpointer.setup();
  }
  return checkpointer;
}
