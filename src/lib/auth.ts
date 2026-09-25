import { randomBytes, createHash } from 'crypto'
import { query } from './db'

const JWT_SECRET: string = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const TOKEN_BYTES = 32

export function hashPassword(password: string): string {
  return createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return createHash('sha256').update(password + JWT_SECRET).digest('hex') === hash
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

interface UserRow { id: string; email: string; password: string }
interface SessionRow { id: string; userId: string }
interface PurchaseRow { id: string }

export async function createUser(email: string, password: string): Promise<{ id: string; email: string }> {
  const id = randomBytes(16).toString('hex')
  const hashed = hashPassword(password)
  await query(
    `INSERT INTO "User" (id, email, password) VALUES ($1, $2, $3)`,
    [id, email, hashed]
  )
  return { id, email }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query(
    `SELECT id, email, password FROM "User" WHERE email = $1`,
    [email]
  )
  return (rows[0] as UserRow) ?? null
}

export async function createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO "Session" (id, "userId", token, "expiresAt") VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString('hex'), userId, token, expiresAt.toISOString()]
  )
}

export async function findSession(token: string): Promise<SessionRow | null> {
  const rows = await query(
    `SELECT s.id, s."userId" FROM "Session" s WHERE s.token = $1 AND s."expiresAt" > NOW()`,
    [token]
  )
  return (rows[0] as SessionRow) ?? null
}

export async function invalidateSession(token: string): Promise<void> {
  await query(`DELETE FROM "Session" WHERE token = $1`, [token])
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId])
}

export async function createPurchase(userId: string, paymentId: string, amount: number): Promise<string> {
  const id = randomBytes(16).toString('hex')
  await query(
    `INSERT INTO "Purchase" (id, "userId", "paymentId", amount) VALUES ($1, $2, $3, $4)`,
    [id, userId, paymentId, amount]
  )
  return id
}

export async function hasActivePurchase(userId: string): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM "Purchase" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId]
  )
  return rows.length > 0
}

export async function markPurchaseEvaluated(purchaseId: string): Promise<void> {
  await query(
    `UPDATE "Purchase" SET "evaluatedAt" = NOW() WHERE id = $1 AND "evaluatedAt" IS NULL`,
    [purchaseId]
  )
}

export async function findUserLatestPurchaseId(userId: string): Promise<string | null> {
  const rows = await query(
    `SELECT id FROM "Purchase" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId]
  )
  return (rows[0] as { id: string })?.id ?? null
}

export async function getUserById(userId: string): Promise<{ id: string; email: string } | null> {
  const rows = await query(
    `SELECT id, email FROM "User" WHERE id = $1`,
    [userId]
  )
  return (rows[0] as { id: string; email: string }) ?? null
}

export function signToken(payload: { userId: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url')
  const sig = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const parts: string[] = token.split('.')
    const [header, body, sig] = [parts[0], parts[1], parts[2]]
    if (!header || !body || !sig) return null
    const expected = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse((Buffer.from(body, 'base64url' as BufferEncoding)).toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload as { userId: string }
  } catch {
    return null
  }
}
