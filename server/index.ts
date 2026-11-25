import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  createClientFolder,
  createProposal,
  googleConfigured,
  googleIdentity,
  googleScopes,
  listCalendarEvents,
  listDriveFiles,
  oauthClient,
  saveAuthorization,
  updateCalendarEvent,
} from './google.ts'
import { createSession, randomState, readCookies, requireAuth, safeEqual, sessionCookie, sessionEmail, transientCookie } from './security.ts'
import { Store } from './store.ts'

const app = express()
const store = await new Store().init()
const port = Number(process.env.PORT || 8787)
const origin = process.env.APP_ORIGIN || 'http://localhost:5173'

if (process.env.NODE_ENV === 'production') {
  const unsafe = [
    !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'change-me-before-production',
    !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32,
    !process.env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY.length < 32,
  ]
  if (unsafe.some(Boolean)) throw new Error('Production requires a non-default ADMIN_PASSWORD and separate SESSION_SECRET and TOKEN_ENCRYPTION_KEY values of at least 32 characters')
}

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }))
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Request-Id', randomUUID())
  next()
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/auth/session', (req, res) => {
  const email = sessionEmail(req)
  res.json({ authenticated: Boolean(email), email })
})

app.post('/api/auth/login', (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Valid email and password are required' })
  const expectedEmail = process.env.ADMIN_EMAIL || 'admin@blhlabs.com'
  const expectedPassword = process.env.ADMIN_PASSWORD || 'change-me-before-production'
  if (!safeEqual(parsed.data.email.toLowerCase(), expectedEmail.toLowerCase()) || !safeEqual(parsed.data.password, expectedPassword)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  res.setHeader('Set-Cookie', sessionCookie(createSession(parsed.data.email)))
  res.json({ authenticated: true, email: parsed.data.email })
})

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0))
  res.status(204).end()
})

app.use('/api', requireAuth)

app.get('/api/platform', (_req, res) => {
  const data = store.snapshot()
  res.json({
    clients: data.clients,
    opportunities: data.opportunities,
    activities: data.activities,
    tiers: data.tiers,
    theme: data.theme,
    google: { configured: googleConfigured(), connected: Boolean(data.googleTokens) },
  })
})

const clientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().default(''),
  tierId: z.string().min(1),
  status: z.enum(['new', 'contacted', 'consultation', 'estimate', 'won', 'lost', 'lead', 'active', 'paused', 'archived']).default('new'),
  notes: z.string().default(''),
  service: z.string().default(''),
  city: z.string().default(''),
  source: z.string().default('Manual entry'),
  followUpDate: z.string().nullable().default(null),
})

app.post('/api/clients', async (req, res, next) => {
  try {
    const input = clientSchema.parse(req.body)
    if (!store.snapshot().tiers.some((tier) => tier.id === input.tierId && tier.active)) return res.status(400).json({ error: 'Unknown or inactive tier' })
    res.status(201).json(await store.createClient(input))
  } catch (error) { next(error) }
})

app.patch('/api/clients/:id', async (req, res, next) => {
  try {
    const patch = clientSchema.partial().parse(req.body)
    const client = await store.updateClient(req.params.id, patch)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.json(client)
  } catch (error) { next(error) }
})

app.delete('/api/clients/:id', async (req, res, next) => {
  try {
    const deleted = await store.deleteClient(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Client not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/clients/:id/activities', async (req, res, next) => {
  try {
    if (!store.snapshot().clients.some((client) => client.id === req.params.id)) return res.status(404).json({ error: 'Client not found' })
    const input = z.object({ type: z.enum(['note', 'call', 'email', 'meeting']), summary: z.string().min(1) }).parse(req.body)
    res.status(201).json(await store.addActivity({ clientId: req.params.id, ...input }))
  } catch (error) { next(error) }
})

app.post('/api/opportunities', async (req, res, next) => {
  try {
    const input = z.object({ clientId: z.string(), title: z.string().min(1), value: z.number().nonnegative(), stage: z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']) }).parse(req.body)
    res.status(201).json(await store.createOpportunity(input))
  } catch (error) { next(error) }
})

app.put('/api/settings/theme', async (req, res, next) => {
  try {
    const theme = z.object({ brandName: z.string().min(1), logoUrl: z.string(), primary: z.string().regex(/^#[0-9a-f]{6}$/i), accent: z.string().regex(/^#[0-9a-f]{6}$/i), surface: z.string().regex(/^#[0-9a-f]{6}$/i) }).parse(req.body)
    res.json(await store.updateTheme(theme))
  } catch (error) { next(error) }
})

app.put('/api/settings/tiers/:id', async (req, res, next) => {
  try {
    const tier = z.object({ name: z.string().min(1), description: z.string(), features: z.array(z.string()), active: z.boolean() }).parse(req.body)
    res.json(await store.addTier({ id: req.params.id, ...tier }))
  } catch (error) { next(error) }
})

app.get('/api/google/connect', (req, res) => {
  if (!googleConfigured()) return res.status(503).json({ error: 'Google OAuth environment variables are not configured' })
  const state = randomState()
  res.setHeader('Set-Cookie', transientCookie('blh_oauth_state', state))
  res.redirect(oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: googleScopes, state }))
})

app.get('/api/google/callback', async (req, res, next) => {
  try {
    const query = z.object({ code: z.string(), state: z.string() }).parse(req.query)
    const expected = readCookies(req).blh_oauth_state
    if (!expected || !safeEqual(expected, query.state)) return res.status(400).send('Invalid OAuth state')
    await saveAuthorization(store, query.code)
    res.setHeader('Set-Cookie', transientCookie('blh_oauth_state', '', 0))
    res.redirect(`${origin}/settings?google=connected`)
  } catch (error) { next(error) }
})

app.get('/api/google/status', async (_req, res) => {
  const data = store.snapshot()
  if (!data.googleTokens) return res.json({ configured: googleConfigured(), connected: false })
  try { res.json({ configured: true, connected: true, account: await googleIdentity(store) }) }
  catch { res.json({ configured: googleConfigured(), connected: false, error: 'Authorization expired or was revoked' }) }
})

app.delete('/api/google/connection', async (_req, res) => {
  await store.saveGoogleTokens(undefined)
  res.status(204).end()
})

app.get('/api/calendar/events', async (req, res, next) => {
  try {
    const range = z.object({ timeMin: z.string().datetime(), timeMax: z.string().datetime() }).parse(req.query)
    res.json(await listCalendarEvents(store, range.timeMin, range.timeMax))
  } catch (error) { next(error) }
})

app.post('/api/calendar/events', async (req, res, next) => {
  try {
    const input = z.object({ title: z.string().min(1), start: z.string().datetime(), end: z.string().datetime(), description: z.string().optional(), location: z.string().optional(), attendees: z.array(z.string().email()).optional() }).parse(req.body)
    res.status(201).json(await createCalendarEvent(store, input))
  } catch (error) { next(error) }
})

const calendarEventSchema = z.object({
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
})

app.patch('/api/calendar/events/:id', async (req, res, next) => {
  try { res.json(await updateCalendarEvent(store, req.params.id, calendarEventSchema.parse(req.body))) }
  catch (error) { next(error) }
})

app.delete('/api/calendar/events/:id', async (req, res, next) => {
  try { await deleteCalendarEvent(store, req.params.id); res.status(204).end() }
  catch (error) { next(error) }
})

app.get('/api/drive/files', async (req, res, next) => {
  try { res.json(await listDriveFiles(store, typeof req.query.folderId === 'string' ? req.query.folderId : undefined)) }
  catch (error) { next(error) }
})

app.post('/api/clients/:id/drive-folder', async (req, res, next) => {
  try {
    const client = store.snapshot().clients.find((item) => item.id === req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const folder = await createClientFolder(store, `${client.customerNumber} — ${client.name}`, z.object({ parentId: z.string().optional() }).parse(req.body).parentId)
    await store.updateClient(client.id, { driveFolderId: folder.id || undefined })
    res.status(201).json(folder)
  } catch (error) { next(error) }
})

app.post('/api/documents/proposals', async (req, res, next) => {
  try {
    const input = z.object({ clientId: z.string(), title: z.string().min(1), summary: z.string().min(1), amount: z.number().nonnegative() }).parse(req.body)
    const client = store.snapshot().clients.find((item) => item.id === input.clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.status(201).json(await createProposal(store, { ...input, clientName: client.name, folderId: client.driveFolderId }))
  } catch (error) { next(error) }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.flatten() })
  const message = error instanceof Error ? error.message : 'Unexpected error'
  res.status(message.includes('not connected') || message.includes('not configured') ? 503 : 500).json({ error: message })
})

const dist = resolve('dist')
if (existsSync(dist)) {
  const backOfficePath = '/optimize/back-office'
  app.use(backOfficePath, express.static(dist))
  app.get(`${backOfficePath}/{*splat}`, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
}

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`BLH Labs API listening on http://localhost:${port}`))

export { app, store }
