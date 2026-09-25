import { randomBytes, createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from './db'

const JWT_SECRET: string = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const TOKEN_BYTES = 32

export const MAX_RUNS_PER_PURCHASE = 3

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2')) return bcrypt.compare(password, hash)
  return createHash('sha256').update(password + JWT_SECRET).digest('hex') === hash
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2')
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

interface UserRow { id: string; email: string; password: string }
interface PurchaseRow { runsUsed: number }

export async function createUser(email: string, password: string): Promise<{ id: string; email: string }> {
  const id = randomBytes(16).toString('hex')
  const hashed = await hashPassword(password)
  await query(
    `INSERT INTO "User" (id, email, password) VALUES ($1, $2, $3)`,
    [id, email, hashed]
  )
  return { id, email }
}

export async function upgradePassword(userId: string, hashed: string): Promise<void> {
  await query(`UPDATE "User" SET password = $1 WHERE id = $2`, [hashed, userId])
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

export async function findSession(token: string): Promise<{ id: string; userId: string } | null> {
  const rows = await query<{ id: string; userId: string }>(
    `SELECT s.id, s."userId" FROM "Session" s WHERE s.token = $1 AND s."expiresAt" > NOW()`,
    [token]
  )
  return rows[0] ?? null
}

export async function invalidateSession(token: string): Promise<void> {
  await query(`DELETE FROM "Session" WHERE "token" = $1`, [token])
}

export async function createPurchase(userId: string, paymentId: string, amount: number): Promise<string> {
  const id = randomBytes(16).toString('hex')
  await query(
    `INSERT INTO "Purchase" (id, "userId", "paymentId", amount, "runsUsed") VALUES ($1, $2, $3, $4, 0)`,
    [id, userId, paymentId, amount]
  )
  return id
}

export interface Entitlement {
  purchased: boolean
  runsUsed: number
  editsLeft: number
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const rows = await query<PurchaseRow>(
    `SELECT "runsUsed" FROM "Purchase" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId]
  )
  const row = rows[0]
  if (!row) return { purchased: false, runsUsed: 0, editsLeft: 0 }
  const runsUsed = Number(row.runsUsed ?? 0)
  return { purchased: true, runsUsed, editsLeft: Math.max(0, MAX_RUNS_PER_PURCHASE - runsUsed) }
}

export async function consumeRun(userId: string): Promise<boolean> {
  const rows = await query<{ runsUsed: number }>(
    `UPDATE "Purchase" SET "runsUsed" = "runsUsed" + 1
     WHERE id = (SELECT id FROM "Purchase" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1)
     RETURNING "runsUsed"`,
    [userId]
  )
  return rows.length > 0
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

export function extractToken(header: string | null): string | null {
  return header?.replace('Bearer ', '') ?? null
}

export async function authenticate(token: string | null): Promise<{ userId: string } | null> {
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const session = await findSession(token)
  if (!session) return null
  return { userId: payload.userId }
}
