import pg, { type PoolClient } from "pg";

export function createPool(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  // PostgreSQL restarts can disconnect idle clients outside a request's try/catch.
  // pg removes these clients; keeping a listener allows the next pass to reconnect.
  pool.on("error", (error) => console.error("Idle database connection closed; reconnecting on next request:", error.name));
  return pool;
}

export async function transaction<T>(pool: pg.Pool, operation: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
