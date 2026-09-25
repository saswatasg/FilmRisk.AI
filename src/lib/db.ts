import { Client } from 'pg'

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await client.query(sql, params)
  return result.rows as T[]
}

export async function ensureTables() {
  await client.connect()
  await query(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS "Session" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS "Purchase" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "paymentId" TEXT NOT NULL,
      amount FLOAT NOT NULL,
      "evaluatedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_session_token ON "Session"(token)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_purchase_user ON "Purchase"("userId")`)
}

export { client }
