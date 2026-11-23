import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Building2, CalendarDays, Check, ChevronRight, CircleUserRound, FileText, FolderOpen,
  LayoutDashboard, LogOut, Menu, Plus, Search, Settings, UsersRound, X,
} from 'lucide-react'
import { api, ApiError } from './api'
import type { Client, Platform, Theme } from './types'

type Route = 'dashboard' | 'clients' | 'calendar' | 'drive' | 'documents' | 'settings'
const routes: { id: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'clients', label: 'CRM', icon: UsersRound },
  { id: 'calendar', label: 'Schedule', icon: CalendarDays },
  { id: 'drive', label: 'Drive', icon: FolderOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const routeFromLocation = (): Route => {
  const value = location.pathname.split('/')[1] as Route
  return routes.some((route) => route.id === value) ? value : 'dashboard'
}

function App() {
  const [session, setSession] = useState<{ authenticated: boolean; email?: string | null } | null>(null)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [route, setRoute] = useState<Route>(routeFromLocation())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const nextSession = await api<{ authenticated: boolean; email?: string | null }>('/auth/session')
    setSession(nextSession)
    if (nextSession.authenticated) setPlatform(await api<Platform>('/platform'))
  }

  useEffect(() => { load().catch((err) => setError(err.message)) }, [])
  useEffect(() => {
    const handle = () => setRoute(routeFromLocation())
    addEventListener('popstate', handle)
    return () => removeEventListener('popstate', handle)
  }, [])

  const navigate = (next: Route) => {
    history.pushState({}, '', next === 'dashboard' ? '/' : `/${next}`)
    setRoute(next)
    setMobileOpen(false)
  }

  if (!session) return <div className="splash"><div className="brand-mark">BLH</div><p>Opening your workspace…</p></div>
  if (!session.authenticated) return <Login onLogin={load} />
  if (!platform) return <div className="splash"><div className="spinner" /></div>

  const themeStyle = {
    '--primary': platform.theme.primary,
    '--accent': platform.theme.accent,
    '--canvas': platform.theme.surface,
  } as React.CSSProperties

  return (
    <div className="app" style={themeStyle}>
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button>
        <div className="brand"><div className="brand-mark">BLH</div><div><strong>{platform.theme.brandName}</strong><span>Back office</span></div></div>
        <nav>{routes.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} />{label}</button>)}</nav>
        <div className="sidebar-foot"><CircleUserRound size={22} /><div><strong>Administrator</strong><span>{session.email}</span></div><button title="Sign out" onClick={async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/' }}><LogOut size={18} /></button></div>
      </aside>
      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} />}
      <main>
        <header><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button><div><span className="eyebrow">BLH LABS / {routes.find((item) => item.id === route)?.label.toUpperCase()}</span><h1>{pageTitle(route)}</h1></div><LiveBadge connected={platform.google.connected} /></header>
        {error && <div className="notice error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
        <div className="content">
          {route === 'dashboard' && <Dashboard platform={platform} navigate={navigate} />}
          {route === 'clients' && <Crm platform={platform} refresh={load} onError={setError} />}
          {route === 'calendar' && <Calendar connected={platform.google.connected} clients={platform.clients} onError={setError} />}
          {route === 'drive' && <Drive connected={platform.google.connected} clients={platform.clients} refresh={load} onError={setError} />}
          {route === 'documents' && <Documents connected={platform.google.connected} clients={platform.clients} onError={setError} />}
          {route === 'settings' && <SettingsPage platform={platform} refresh={load} onError={setError} />}
        </div>
      </main>
    </div>
  )
}

function pageTitle(route: Route) {
  return ({ dashboard: 'Good work starts here.', clients: 'Relationships, organized.', calendar: 'Make time count.', drive: 'Everything in its place.', documents: 'Proposals that move.', settings: 'Make it yours.' })[route]
}

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState('admin@blhlabs.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); await onLogin() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="login-page"><div className="login-story"><div className="brand-mark">BLH</div><p className="eyebrow">THE BUSINESS PLATFORM</p><h1>One calm place<br />to run the work.</h1><p>Clients, schedules, files, and proposals—connected to the Google Workspace you already use.</p></div><form className="login-card" onSubmit={submit}><div><span className="eyebrow">WELCOME BACK</span><h2>Sign in to BLH Labs</h2><p>Use the administrator credentials configured on the server.</p></div>{error && <div className="notice error">{error}</div>}<label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /></label><button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight size={18} /></button></form></div>
}

function LiveBadge({ connected }: { connected: boolean }) {
  return <div className={connected ? 'live-badge connected' : 'live-badge'}><span />{connected ? 'Google connected' : 'Google setup needed'}</div>
}

function Dashboard({ platform, navigate }: { platform: Platform; navigate: (route: Route) => void }) {
  const pipeline = platform.opportunities.filter((item) => !['won', 'lost'].includes(item.stage)).reduce((total, item) => total + item.value, 0)
  const active = platform.clients.filter((item) => item.status === 'active').length
  return <>
    <section className="hero-card"><div><span className="eyebrow">TODAY AT A GLANCE</span><h2>Your business, in focus.</h2><p>Move relationships forward, keep commitments visible, and give every client a polished experience.</p></div><button className="button light" onClick={() => navigate('clients')}><Plus size={17} />Add a client</button></section>
    <section className="metrics"><Metric label="Active clients" value={String(active)} detail={`${platform.clients.filter((c) => c.isDemo).length} demo account`} /><Metric label="Open pipeline" value={money(pipeline)} detail={`${platform.opportunities.length} opportunities`} /><Metric label="Workspace" value={platform.google.connected ? 'Connected' : 'Not connected'} detail="Calendar · Drive · Docs" /></section>
    <section className="split"><div className="panel"><PanelHead title="Client portfolio" action="Open CRM" onClick={() => navigate('clients')} /><div className="client-list">{platform.clients.slice(0, 5).map((client) => <ClientRow key={client.id} client={client} tier={platform.tiers.find((tier) => tier.id === client.tierId)?.name} />)}</div></div><div className="panel"><PanelHead title="A clean starting point" /><div className="checklist"><CheckItem done text="Cedar & Stone demo customer seeded" /><CheckItem done={platform.google.connected} text="Connect Google Workspace" /><CheckItem done={platform.clients.some((c) => !c.isDemo)} text="Add your first live customer" /><CheckItem done={platform.opportunities.length > 0} text="Create a sales opportunity" /></div></div></section>
  </>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function PanelHead({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="panel-head"><h3>{title}</h3>{action && <button onClick={onClick}>{action}<ChevronRight size={15} /></button>}</div> }
function CheckItem({ done, text }: { done: boolean; text: string }) { return <div className={done ? 'check done' : 'check'}><span>{done && <Check size={14} />}</span>{text}</div> }
function ClientRow({ client, tier, action }: { client: Client; tier?: string; action?: ReactNode }) { return <div className="client-row"><div className="avatar">{initials(client.name)}</div><div className="grow"><div><strong>{client.name}</strong>{client.isDemo && <span className="demo-pill">DEMO</span>}</div><span>{client.customerNumber} · {client.email}</span></div><span className="tier-pill">{tier || client.tierId}</span>{action}</div> }

function Crm({ platform, refresh, onError }: { platform: Platform; refresh: () => Promise<void>; onError: (value: string) => void }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const clients = platform.clients.filter((client) => `${client.name} ${client.email} ${client.customerNumber}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className="toolbar"><div className="search"><Search size={18} /><input placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="button primary" onClick={() => setAdding(true)}><Plus size={17} />New client</button></div><div className="panel"><div className="table-head"><span>Client</span><span>Status</span><span>Tier</span></div>{clients.map((client) => <div className="table-row clickable" key={client.id} onClick={() => setSelected(client)}><ClientRow client={client} tier={platform.tiers.find((tier) => tier.id === client.tierId)?.name} /><span className={`status ${client.status}`}>{client.status}</span><span>{platform.tiers.find((tier) => tier.id === client.tierId)?.name}</span></div>)}</div>{adding && <Modal title="Add a client" onClose={() => setAdding(false)}><ClientForm tiers={platform.tiers} onSave={async (body) => { try { await api('/clients', { method: 'POST', body: JSON.stringify(body) }); await refresh(); setAdding(false) } catch (err) { onError((err as Error).message) } }} /></Modal>}{selected && <Modal title={selected.name} onClose={() => setSelected(null)}><ClientWorkspace client={selected} platform={platform} refresh={refresh} onError={onError} /></Modal>}</>
}

function ClientWorkspace({ client, platform, refresh, onError }: { client: Client; platform: Platform; refresh: () => Promise<void>; onError: (value: string) => void }) {
  const activities = platform.activities.filter((item) => item.clientId === client.id)
  const opportunities = platform.opportunities.filter((item) => item.clientId === client.id)
  const addNote = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); try { await api(`/clients/${client.id}/activities`, { method: 'POST', body: JSON.stringify({ type: data.get('type'), summary: data.get('summary') }) }); form.reset(); await refresh() } catch (e) { onError((e as Error).message) } }
  const addOpportunity = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); try { await api('/opportunities', { method: 'POST', body: JSON.stringify({ clientId: client.id, title: data.get('title'), value: Number(data.get('value')), stage: data.get('stage') }) }); form.reset(); await refresh() } catch (e) { onError((e as Error).message) } }
  return <div className="client-workspace"><div className="client-summary"><div><span>Customer</span><strong>{client.customerNumber}</strong></div><div><span>Email</span><strong>{client.email}</strong></div><div><span>Status</span><strong>{client.status}</strong></div>{client.isDemo && <div><span>Data class</span><strong>Demo only</strong></div>}</div><section><h3>Pipeline</h3>{opportunities.map((item) => <div className="mini-row" key={item.id}><div><strong>{item.title}</strong><span>{item.stage}</span></div><strong>{money(item.value)}</strong></div>)}<form className="inline-form" onSubmit={addOpportunity}><input name="title" placeholder="Opportunity" required /><input name="value" type="number" min="0" placeholder="Value" required /><select name="stage"><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="won">Won</option></select><button className="button primary">Add</button></form></section><section><h3>Activity</h3>{activities.map((item) => <div className="mini-row" key={item.id}><div><strong>{item.summary}</strong><span>{item.type} · {new Date(item.occurredAt).toLocaleString()}</span></div></div>)}<form className="inline-form activity-form" onSubmit={addNote}><select name="type"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option></select><input name="summary" placeholder="What happened?" required /><button className="button primary">Log</button></form></section></div>
}

function ClientForm({ tiers, onSave }: { tiers: Platform['tiers']; onSave: (value: object) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); await onSave(Object.fromEntries(data)); setBusy(false) }
  return <form className="form-grid" onSubmit={submit}><label className="wide">Company name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phone" /></label><label>Tier<select name="tierId">{tiers.filter((t) => t.active).map((tier) => <option value={tier.id} key={tier.id}>{tier.name}</option>)}</select></label><label>Status<select name="status"><option value="lead">Lead</option><option value="active">Active</option><option value="paused">Paused</option></select></label><label className="wide">Notes<textarea name="notes" rows={3} /></label><button className="button primary wide" disabled={busy}>{busy ? 'Saving…' : 'Create client'}</button></form>
}

function GoogleRequired({ title }: { title: string }) { return <div className="empty-state"><div className="empty-icon"><Building2 /></div><h2>{title}</h2><p>Connect a real Google Workspace account in Settings. This area never displays sample integration data.</p><a className="button primary" href="/settings">Open settings</a></div> }

function Calendar({ connected, clients, onError }: { connected: boolean; clients: Client[]; onError: (value: string) => void }) {
  const [events, setEvents] = useState<{ id: string; title: string; start: string; end: string; htmlLink?: string }[]>([])
  const [adding, setAdding] = useState(false)
  useEffect(() => { if (connected) { const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 30); api<typeof events>(`/calendar/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`).then(setEvents).catch((e) => onError(e.message)) } }, [connected])
  if (!connected) return <GoogleRequired title="Your live calendar belongs here." />
  return <><div className="toolbar"><p className="muted">Next 30 days from your primary Google Calendar</p><button className="button primary" onClick={() => setAdding(true)}><Plus size={17} />Schedule</button></div><div className="panel event-list">{events.length ? events.map((event) => <a className="event" href={event.htmlLink} target="_blank" key={event.id}><div className="event-date"><strong>{new Date(event.start).getDate()}</strong><span>{new Date(event.start).toLocaleString('en', { month: 'short' })}</span></div><div><strong>{event.title}</strong><span>{dateTime(event.start)} – {new Date(event.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><ChevronRight /></a>) : <p className="empty-copy">No upcoming events found.</p>}</div>{adding && <Modal title="Schedule an event" onClose={() => setAdding(false)}><EventForm clients={clients} onSave={async (body) => { try { await api('/calendar/events', { method: 'POST', body: JSON.stringify(body) }); setAdding(false); location.reload() } catch (e) { onError((e as Error).message) } }} /></Modal>}</>
}

function EventForm({ clients, onSave }: { clients: Client[]; onSave: (value: object) => Promise<void> }) {
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ title: data.get('title'), start: new Date(String(data.get('start'))).toISOString(), end: new Date(String(data.get('end'))).toISOString(), description: data.get('description'), attendees: data.get('client') ? [data.get('client')] : [] }) }
  return <form className="form-grid" onSubmit={submit}><label className="wide">Title<input name="title" required /></label><label>Starts<input type="datetime-local" name="start" required /></label><label>Ends<input type="datetime-local" name="end" required /></label><label className="wide">Invite client<select name="client"><option value="">No invitation</option>{clients.map((c) => <option key={c.id} value={c.email}>{c.name} — {c.email}</option>)}</select></label><label className="wide">Description<textarea name="description" rows={3} /></label><button className="button primary wide">Create Google Calendar event</button></form>
}

function Drive({ connected, clients, refresh, onError }: { connected: boolean; clients: Client[]; refresh: () => Promise<void>; onError: (value: string) => void }) {
  const [files, setFiles] = useState<{ id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }[]>([])
  useEffect(() => { if (connected) api<typeof files>('/drive/files').then(setFiles).catch((e) => onError(e.message)) }, [connected])
  if (!connected) return <GoogleRequired title="Browse the Drive you actually use." />
  const createFolder = async (client: Client) => { try { await api(`/clients/${client.id}/drive-folder`, { method: 'POST', body: '{}' }); await refresh() } catch (e) { onError((e as Error).message) } }
  return <div className="split drive-grid"><div className="panel"><PanelHead title="My Drive" />{files.length ? files.map((file) => <a className="file-row" href={file.webViewLink} target="_blank" key={file.id}>{file.mimeType.includes('folder') ? <FolderOpen /> : <FileText />}<div><strong>{file.name}</strong><span>{file.modifiedTime ? `Updated ${new Date(file.modifiedTime).toLocaleDateString()}` : 'Google Drive'}</span></div><ChevronRight /></a>) : <p className="empty-copy">This Drive folder is empty.</p>}</div><div className="panel"><PanelHead title="Client folders" />{clients.map((client) => <div className="folder-client" key={client.id}><div><strong>{client.name}</strong><span>{client.driveFolderId ? 'Folder connected' : 'No folder yet'}</span></div>{client.driveFolderId ? <Check size={18} /> : <button onClick={() => createFolder(client)}>Create</button>}</div>)}</div></div>
}

function Documents({ connected, clients, onError }: { connected: boolean; clients: Client[]; onError: (value: string) => void }) {
  const [result, setResult] = useState<{ webViewLink?: string; name?: string } | null>(null)
  if (!connected) return <GoogleRequired title="Create proposals in Google Docs." />
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { setResult(await api('/documents/proposals', { method: 'POST', body: JSON.stringify({ clientId: data.get('clientId'), title: data.get('title'), summary: data.get('summary'), amount: Number(data.get('amount')) }) })) } catch (e) { onError((e as Error).message) } }
  return <div className="document-layout"><form className="panel proposal-form" onSubmit={submit}><span className="eyebrow">NEW GOOGLE DOC</span><h2>Build a client proposal</h2><p>A real document will be created in the client’s connected folder, or in My Drive when no folder is assigned.</p><label>Client<select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Proposal title<input name="title" defaultValue="Service proposal" required /></label><label>Scope summary<textarea name="summary" rows={7} required placeholder="Describe the work, outcome, and key deliverables…" /></label><label>Investment<input name="amount" type="number" min="0" step="0.01" required /></label><button className="button primary">Create in Google Docs</button>{result && <a className="success-link" href={result.webViewLink} target="_blank"><Check />{result.name || 'Proposal created'}<ChevronRight /></a>}</form><div className="doc-preview"><span>BLH LABS</span><h2>A polished starting point.</h2><p>Proposal documents include your title, client, scope, investment, and firm attribution. Extend the generator in the backend with your own branded Google Docs template when ready.</p></div></div>
}

function SettingsPage({ platform, refresh, onError }: { platform: Platform; refresh: () => Promise<void>; onError: (value: string) => void }) {
  const [theme, setTheme] = useState<Theme>(platform.theme)
  const save = async (event: FormEvent) => { event.preventDefault(); try { await api('/settings/theme', { method: 'PUT', body: JSON.stringify(theme) }); await refresh() } catch (e) { onError((e as Error).message) } }
  return <div className="settings-grid"><section className="panel settings-section"><span className="eyebrow">APPEARANCE</span><h2>Brand theme</h2><form className="theme-form" onSubmit={save}><label>Brand name<input value={theme.brandName} onChange={(e) => setTheme({ ...theme, brandName: e.target.value })} /></label><label>Logo URL<input value={theme.logoUrl} onChange={(e) => setTheme({ ...theme, logoUrl: e.target.value })} placeholder="https://…" /></label><div className="colors"><ColorField label="Primary" value={theme.primary} onChange={(primary) => setTheme({ ...theme, primary })} /><ColorField label="Accent" value={theme.accent} onChange={(accent) => setTheme({ ...theme, accent })} /><ColorField label="Canvas" value={theme.surface} onChange={(surface) => setTheme({ ...theme, surface })} /></div><button className="button primary">Save theme</button></form></section><section className="panel settings-section"><span className="eyebrow">INTEGRATIONS</span><h2>Google Workspace</h2><p>OAuth runs entirely through the backend. Refresh tokens are encrypted at rest and are never sent to the browser.</p><div className="connection-card"><LiveBadge connected={platform.google.connected} /><span>{platform.google.connected ? 'Calendar, Drive, and Docs are live.' : platform.google.configured ? 'Ready to authorize a Workspace account.' : 'OAuth setup is required before authorization can finish.'}</span>{platform.google.connected ? <button className="button danger" onClick={async () => { await api('/google/connection', { method: 'DELETE' }); await refresh() }}>Disconnect</button> : platform.google.configured ? <a className="button primary" href="/api/google/connect">Connect Google</a> : <button className="button primary" onClick={() => onError('Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env, restart the server, then click Connect Google again.')}>Connect Google</button>}</div></section><section className="panel settings-section"><span className="eyebrow">SERVICE TIERS</span><h2>Extensible by design</h2><p>Clients reference stable tier IDs. Add or update tiers through the authenticated API without changing the CRM model.</p>{platform.tiers.map((tier) => <div className="tier-card" key={tier.id}><div><strong>{tier.name}</strong><span>{tier.description}</span></div><span>{tier.features.length} features</span></div>)}</section></div>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label>{label}<span className="color-input"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /><input value={value} onChange={(e) => onChange(e.target.value)} /></span></label> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} /><section className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X /></button></div>{children}</section></div> }

const initials = (name: string) => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const dateTime = (value: string) => new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default App
