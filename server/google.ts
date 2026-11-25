import { google } from 'googleapis'
import type { Credentials } from 'google-auth-library'
import { decryptJson, encryptJson } from './security.ts'
import type { Store } from './store.ts'

export const googleScopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
]

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

export function oauthClient() {
  if (!googleConfigured()) throw new Error('Google OAuth is not configured')
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export function connectedClient(store: Store) {
  const encrypted = store.snapshot().googleTokens
  if (!encrypted) throw new Error('Google Workspace is not connected')
  const client = oauthClient()
  client.setCredentials(decryptJson<Credentials>(encrypted))
  client.on('tokens', async (tokens) => {
    const current = decryptJson<Credentials>(store.snapshot().googleTokens || encrypted)
    await store.saveGoogleTokens(encryptJson({ ...current, ...tokens }))
  })
  return client
}

export async function saveAuthorization(store: Store, code: string) {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  await store.saveGoogleTokens(encryptJson(tokens))
}

export async function googleIdentity(store: Store) {
  const auth = connectedClient(store)
  const oauth = google.oauth2({ version: 'v2', auth })
  const { data } = await oauth.userinfo.get()
  return { email: data.email, name: data.name }
}

export async function listCalendarEvents(store: Store, timeMin: string, timeMax: string) {
  const calendar = google.calendar({ version: 'v3', auth: connectedClient(store) })
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })
  return (data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || '(Untitled)',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    location: event.location || '',
<<<<<<< HEAD
    description: event.description || '',
=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
    htmlLink: event.htmlLink,
  }))
}

<<<<<<< HEAD
export async function updateCalendarEvent(store: Store, eventId: string, input: {
  title: string
  start: string
  end: string
  description?: string
  location?: string
  attendees?: string[]
}) {
  const calendar = google.calendar({ version: 'v3', auth: connectedClient(store) })
  const { data } = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: input.attendees?.length ? 'all' : 'none',
    requestBody: {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      attendees: input.attendees?.map((email) => ({ email })),
    },
  })
  return { id: data.id, htmlLink: data.htmlLink }
}

export async function deleteCalendarEvent(store: Store, eventId: string) {
  const calendar = google.calendar({ version: 'v3', auth: connectedClient(store) })
  await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' })
}

=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
export async function createCalendarEvent(store: Store, input: {
  title: string
  start: string
  end: string
  description?: string
<<<<<<< HEAD
  location?: string
=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
  attendees?: string[]
}) {
  const calendar = google.calendar({ version: 'v3', auth: connectedClient(store) })
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: input.attendees?.length ? 'all' : 'none',
    requestBody: {
      summary: input.title,
      description: input.description,
<<<<<<< HEAD
      location: input.location,
=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      attendees: input.attendees?.map((email) => ({ email })),
    },
  })
  return { id: data.id, htmlLink: data.htmlLink }
}

export async function listDriveFiles(store: Store, folderId?: string) {
  const drive = google.drive({ version: 'v3', auth: connectedClient(store) })
  const parent = folderId || 'root'
  const { data } = await drive.files.list({
    q: `'${parent.replaceAll("'", "\\'")}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)',
    orderBy: 'folder,name',
    pageSize: 100,
  })
  return data.files || []
}

export async function createClientFolder(store: Store, clientName: string, parentId?: string) {
  const drive = google.drive({ version: 'v3', auth: connectedClient(store) })
  const { data } = await drive.files.create({
    requestBody: {
      name: clientName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id,name,webViewLink',
  })
  return data
}

export async function createProposal(store: Store, input: {
  clientName: string
  title: string
  summary: string
  amount: number
  folderId?: string
}) {
  const auth = connectedClient(store)
  const docs = google.docs({ version: 'v1', auth })
  const drive = google.drive({ version: 'v3', auth })
  const { data: document } = await docs.documents.create({ requestBody: { title: input.title } })
  if (!document.documentId) throw new Error('Google did not return a document ID')
  const body = `${input.title}\n\nPrepared for ${input.clientName}\n\n${input.summary}\n\nInvestment: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(input.amount)}\n\nPrepared by BLH Labs\n`
  await docs.documents.batchUpdate({
    documentId: document.documentId,
    requestBody: {
      requests: [
        { insertText: { location: { index: 1 }, text: body } },
        { updateParagraphStyle: { range: { startIndex: 1, endIndex: input.title.length + 2 }, paragraphStyle: { namedStyleType: 'TITLE' }, fields: 'namedStyleType' } },
      ],
    },
  })
  if (input.folderId) {
    const existing = await drive.files.get({ fileId: document.documentId, fields: 'parents' })
    await drive.files.update({
      fileId: document.documentId,
      addParents: input.folderId,
      removeParents: existing.data.parents?.join(','),
      fields: 'id,parents',
    })
  }
  const file = await drive.files.get({ fileId: document.documentId, fields: 'id,name,webViewLink' })
  return file.data
}
