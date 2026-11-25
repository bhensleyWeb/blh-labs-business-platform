import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from './api'
import type { Client } from './types'

type CalendarChoice = { id: string; name: string; primary: boolean; writable: boolean }
type CalendarEvent = { id: string; title: string; start: string; end: string; location?: string; description?: string; htmlLink?: string }
type EventList = { key: string; items: CalendarEvent[] }
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const allDay = (item: CalendarEvent) => item.start.length === 10
const eventDay = (item: CalendarEvent) => allDay(item) ? item.start : dateKey(new Date(item.start))
const eventTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function localInput(value: string) {
  const date = new Date(value)
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = 1 - first.getDay()
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, start + index))
}

function eventEndpoint(calendarId: string, eventId?: string) {
  const eventPath = eventId ? '/' + encodeURIComponent(eventId) : ''
  return `/calendar/events${eventPath}?${new URLSearchParams({ calendarId })}`
}

export function FreebuffCalendar({ connected, clients, onError }: {
  connected: boolean
  clients: Client[]
  onError: (message: string) => void
}) {
  const today = new Date()
  const todayKey = dateKey(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [calendars, setCalendars] = useState<CalendarChoice[] | null>(null)
  const [calendarId, setCalendarId] = useState('')
  const [calendarLoad, setCalendarLoad] = useState(0)
  const [calendarError, setCalendarError] = useState('')
  const [eventList, setEventList] = useState<EventList | null>(null)
  const [eventLoad, setEventLoad] = useState(0)
  const [eventError, setEventError] = useState('')
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const activeCalendar = calendars?.find((calendar) => calendar.id === calendarId)
  const cells = useMemo(() => monthGrid(month.getFullYear(), month.getMonth()), [month])
  const rangeKey = `${calendarId}|${dateKey(month)}`
  const events = eventList?.key === rangeKey ? eventList.items : []

  useEffect(() => {
    if (!connected) return
    const controller = new AbortController()
    setCalendarError('')
    api<CalendarChoice[]>('/calendar/calendars', { signal: controller.signal })
      .then((items) => {
        setCalendars(items)
        setCalendarId((current) => items.some((item) => item.id === current)
          ? current : (items.find((item) => item.primary) ?? items[0])?.id ?? '')
      })
      .catch((error: Error) => { if (!controller.signal.aborted) setCalendarError(error.message) })
    return () => controller.abort()
  }, [connected, calendarLoad])

  useEffect(() => {
    if (!connected || !calendarId) return
    const controller = new AbortController()
    const end = new Date(cells[41])
    end.setDate(end.getDate() + 1)
    const range = new URLSearchParams({
      calendarId, timeMin: cells[0].toISOString(), timeMax: end.toISOString(),
    })
    setEventError('')
    api<CalendarEvent[]>(`/calendar/events?${range}`, { signal: controller.signal })
      .then((items) => setEventList({ key: rangeKey, items }))
      .catch((error: Error) => { if (!controller.signal.aborted) setEventError(error.message) })
    return () => controller.abort()
  }, [calendarId, cells, connected, eventLoad, rangeKey])

  if (!connected) {
    return <div className="empty-state"><CalendarDays/><h2>Connect Google Calendar</h2>
      <p>Use Settings to authorize Google Workspace before scheduling live events.</p></div>
  }

  function selectCalendar(id: string) {
    setEditing(null)
    setCalendarId(id)
  }

  function moveMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    setMonth(next)
    setSelectedDate(dateKey(next))
    setEditing(null)
  }

  async function createCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('calendarName') ?? '').trim()
    if (!name) { onError('Enter a calendar name.'); return }
    setBusy(true)
    try {
      const calendar = await api<CalendarChoice>('/calendar/calendars', {
        method: 'POST',
        body: JSON.stringify({ name, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }),
      })
      setCalendars((items) => [...(items ?? []).filter((item) => item.id !== calendar.id), calendar])
      selectCalendar(calendar.id)
      setCalendarError('')
      setCreating(false)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeCalendar?.writable) return
    const form = event.currentTarget
    const data = new FormData(form)
    const attendee = String(data.get('attendee') || '')
    setBusy(true)
    try {
      const start = new Date(String(data.get('start')))
      const end = new Date(String(data.get('end')))
      if (!(end > start)) throw new Error('The end must be after the start.')
      await api(eventEndpoint(activeCalendar.id, editing?.id), {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: data.get('title'), start: start.toISOString(), end: end.toISOString(),
          location: data.get('location'), description: data.get('description'),
          ...(attendee ? { attendees: [attendee] } : {}),
        }),
      })
      form.reset()
      setEditing(null)
      setMonth(new Date(start.getFullYear(), start.getMonth(), 1))
      setSelectedDate(dateKey(start))
      setEventLoad((version) => version + 1)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeEvent(item: CalendarEvent) {
    if (!activeCalendar?.writable || !confirm(`Remove “${item.title}” from ${activeCalendar.name}?`)) return
    setBusy(true)
    try {
      await api(eventEndpoint(activeCalendar.id, item.id), { method: 'DELETE' })
      if (editing?.id === item.id) setEditing(null)
      setEventLoad((version) => version + 1)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dayEvents = new Map<string, CalendarEvent[]>()
  for (const item of events) {
    const day = eventDay(item)
    if (!dayEvents.has(day)) dayEvents.set(day, [])
    dayEvents.get(day)?.push(item)
  }
  const selected = dayEvents.get(selectedDate) ?? []

  return <>
    <div className="admin-pagehead"><div><h1>Calendar</h1>
      <p className="admin-pagehead__sub">View events and schedule appointments in your Google calendars.</p></div>
      <span className="pill pill--available"><Check size={10}/>Google Calendar live</span>
    </div>
    <section className="card">
      <div className="card__head"><div><h2 className="card__title">Google calendars</h2>
        <p className="card__hint">Select the calendar to view and schedule in.</p></div>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setCreating(!creating)} disabled={busy}>
          <Plus size={13}/>{creating ? 'Cancel' : 'New calendar'}
        </button>
      </div>
      <div className="appointment-form">
        <div className="field"><label htmlFor="google-calendar-choice">Calendar</label>
          <select id="google-calendar-choice" value={calendarId} onChange={(event) => selectCalendar(event.target.value)}
            disabled={busy || !calendars?.length}>
            {!calendars?.length && <option value="">{calendarError ? 'Could not load calendars' : calendars ? 'No calendars found' : 'Loading calendars…'}</option>}
            {calendars?.map((calendar) => <option key={calendar.id} value={calendar.id}>
              {calendar.name}{calendar.primary ? ' (Primary)' : ''}{!calendar.writable ? ' (Read only)' : ''}
            </option>)}
          </select>
        </div>
        {calendarError && <p role="alert">{calendarError} <button type="button" className="card__link" onClick={() => setCalendarLoad((version) => version + 1)}>Retry</button></p>}
      </div>
      {creating && <form className="appointment-form" onSubmit={createCalendar}>
        <div className="field"><label htmlFor="new-calendar-name">Calendar name</label>
          <input id="new-calendar-name" name="calendarName" required maxLength={255}/></div>
        <button className="btn btn--primary btn--sm" disabled={busy || (calendars === null && !calendarError)}>
          {busy ? 'Creating…' : 'Create calendar'}
        </button>
      </form>}
    </section>
    {activeCalendar && <div className="cal-layout" style={{ marginTop: 14 }}>
      <section className="card">
        <div className="cal-toolbar"><div><h2 className="cal-month">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
          <p className="card__hint">{activeCalendar.name}</p></div>
          <div className="cal-nav">
            <button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={14}/></button>
            <button style={{ width: 'auto', padding: '0 8px', fontSize: 10 }} onClick={() => {
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelectedDate(todayKey)
              setEditing(null)
            }}>Today</button>
            <button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={14}/></button>
          </div>
        </div>
        <div className="cal-grid">{weekdays.map((day) => <div className="cal-dow" key={day}>{day}</div>)}
          {cells.map((cell) => {
            const key = dateKey(cell)
            const items = dayEvents.get(key) ?? []
            return <button key={key} className={['cal-day', cell.getMonth() !== month.getMonth() && 'cal-day--muted',
              key === selectedDate && 'cal-day--selected', key === todayKey && 'cal-day--today'].filter(Boolean).join(' ')}
              onClick={() => { setSelectedDate(key); setEditing(null) }}>
              <span className="cal-day__num">{cell.getDate()}</span>
              <span className="cal-day__events" data-count={items.length}>{items.slice(0, 2).map((item) => (
                <span className="cal-event" key={item.id}>{allDay(item) ? 'All day' : eventTime(item.start)} {item.title}</span>
              ))}{items.length > 2 && <span className="cal-more">+{items.length - 2} more</span>}</span>
            </button>
          })}
        </div>
      </section>
      <div className="dash-col">
        <section className="card"><div className="card__head"><div>
          <h2 className="card__title">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</h2>
          <p className="card__hint">{eventError ? 'Could not load events' : eventList?.key !== rangeKey ? 'Loading events…' : `${selected.length} scheduled`}</p>
        </div></div>
          {eventError && <p className="dash-empty" role="alert">{eventError} <button className="card__link" onClick={() => setEventLoad((version) => version + 1)}>Retry</button></p>}
          {selected.length > 0 && <div className="cal-agenda">{selected.map((item) => (
            <div className="cal-agenda__item" key={item.id}>
              <div className="cal-agenda__row"><span className="cal-agenda__time">{allDay(item) ? 'All day' : `${eventTime(item.start)}–${eventTime(item.end)}`}</span></div>
              <div className="cal-agenda__title">{item.title}</div>
              <p className="cal-agenda__notes">{[item.location, item.description].filter(Boolean).join(' — ')}</p>
              {activeCalendar.writable && <div className="cal-agenda__actions">
                {allDay(item) ? item.htmlLink && <a className="btn btn--ghost btn--sm" href={item.htmlLink} target="_blank" rel="noreferrer">Edit in Google</a>
                  : <button className="btn btn--ghost btn--sm" onClick={() => setEditing(item)} disabled={busy}><Pencil size={11}/>Edit</button>}
                <button className="btn btn--ghost btn--sm" onClick={() => removeEvent(item)} disabled={busy}><Trash2 size={11}/>Remove</button>
              </div>}
            </div>
          ))}</div>}
          {!eventError && eventList?.key === rangeKey && selected.length === 0 && <p className="dash-empty">No appointments on this day.</p>}
        </section>
        {activeCalendar.writable ? <section className="card">
          <div className="card__head"><div><h2 className="card__title">{editing ? 'Edit appointment' : 'Add appointment'}</h2>
            <p className="card__hint">Calendar: {activeCalendar.name}</p></div>
            {editing && <button className="card__link" onClick={() => setEditing(null)}>New event</button>}
          </div>
          <form className="appointment-form" onSubmit={saveEvent} key={JSON.stringify([calendarId, selectedDate, editing?.id])}>
            <div className="field"><label htmlFor="appointment-title">Title</label><input id="appointment-title" name="title" defaultValue={editing?.title} required/></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="appointment-start">Starts</label><input id="appointment-start" name="start" type="datetime-local" defaultValue={editing ? localInput(editing.start) : `${selectedDate}T09:00`} required/></div>
              <div className="field"><label htmlFor="appointment-end">Ends</label><input id="appointment-end" name="end" type="datetime-local" defaultValue={editing ? localInput(editing.end) : `${selectedDate}T10:00`} required/></div>
            </div>
            <div className="field"><label htmlFor="appointment-location">Location</label><input id="appointment-location" name="location" defaultValue={editing?.location}/></div>
            <div className="field"><label htmlFor="appointment-attendee">Invite lead</label><select id="appointment-attendee" name="attendee" defaultValue="">
              <option value="">{editing ? 'Keep current invitations' : 'No invitation'}</option>
              {clients.map((client) => <option key={client.id} value={client.email}>{client.name} — {client.email}</option>)}
            </select></div>
            <div className="field"><label htmlFor="appointment-notes">Notes</label><textarea id="appointment-notes" name="description" defaultValue={editing?.description}/></div>
            <button className="btn btn--primary btn--sm" disabled={busy}><Clock3 size={12}/>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to calendar'}</button>
          </form>
        </section> : <p className="dash-empty">This calendar is read-only. Choose another calendar to add an appointment.</p>}
      </div>
    </div>}
  </>
}
