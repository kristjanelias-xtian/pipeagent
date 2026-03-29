import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const connString = process.env.DATABASE_URL;
    if (!connString) throw new Error('Missing DATABASE_URL');
    checkpointer = PostgresSaver.fromConnString(connString);
    await checkpointer.setup();
  }
  return checkpointer;
}
