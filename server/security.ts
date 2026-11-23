import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

const cookieName = 'blh_session'

const secret = () => process.env.SESSION_SECRET || 'development-only-secret-change-me'
const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url')

export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ sub: email, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readCookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, decodeURIComponent(value.join('='))]
    }),
  )
}

export function sessionEmail(req: Request) {
  const token = readCookies(req)[cookieName]
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
    return decoded.exp > Date.now() ? decoded.sub : null
  } catch {
    return null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const email = sessionEmail(req)
  if (!email) return res.status(401).json({ error: 'Authentication required' })
  res.locals.userEmail = email
  next()
}

export function sessionCookie(value: string, maxAge = 43_200) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function transientCookie(name: string, value: string, maxAge = 600) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function encryptionKey() {
  return createHmac('sha256', 'blh-google-token-v1').update(process.env.TOKEN_ENCRYPTION_KEY || 'development-key-change-me').digest()
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptJson<T>(value: string): T {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as T
}

export const randomState = () => randomBytes(24).toString('base64url')
