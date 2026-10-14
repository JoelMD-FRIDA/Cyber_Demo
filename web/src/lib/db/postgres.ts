import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export const WRITE_LOCK = 734291861;
let pool: Pool | undefined;
export function database() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Database configuration is unavailable.');
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10_000, statement_timeout: 4000, lock_timeout: 1000,
      idle_in_transaction_session_timeout: 60_000 });
    pool.on('error', () => { console.error('Database connection failed.'); });
  }
  return pool;
}
export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return database().query<T>(text, values);
}
export async function withWrites<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock_shared($1)', [WRITE_LOCK]);
    const state = await client.query('SELECT active FROM app_maintenance WHERE id=true');
    if (state.rows[0]?.active !== false) throw new Error('Application maintenance is active.');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

// Hold a shared maintenance lock while external work/file writes occur, while
// committing each fence/submission marker separately for crash recovery.
export async function withWriteLease<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  let broken = false;
  try {
    await client.query('SELECT pg_advisory_lock_shared($1)',[WRITE_LOCK]);
    const state = await client.query('SELECT active FROM app_maintenance WHERE id=true');
    if (state.rows[0]?.active !== false) throw new Error('Application maintenance is active.');
    return await operation(client);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock_shared($1)',[WRITE_LOCK]); }
    catch { broken = true; }
    client.release(broken);
  }
}
