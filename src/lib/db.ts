import { Pool, PoolClient } from 'pg'

// Singleton pool — survives Next.js hot-reload in dev via globalThis
const globalForPg = globalThis as unknown as { _pgPool?: Pool }

export const pool: Pool = globalForPg._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

if (process.env.NODE_ENV !== 'production') {
  globalForPg._pgPool = pool
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query(text, params)
  return (result.rows[0] as T) ?? null
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
