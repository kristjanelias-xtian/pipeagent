import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const connString = process.env.DATABASE_URL;
    if (!connString) throw new Error('Missing DATABASE_URL');
    const pool = new pg.Pool({
      connectionString: connString,
      ssl: { rejectUnauthorized: false },
    });
    checkpointer = new PostgresSaver(pool);
    await checkpointer.setup();
  }
  return checkpointer;
}
