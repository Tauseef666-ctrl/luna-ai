import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CalendarEvent } from '../shared/types'
import { activity } from './activity'
import { loadConfig } from './config'

const CALENDAR_FILE = 'memory/calendar.json'

let events: CalendarEvent[] = []
let inited = false

function storePath(): string {
  return join(loadConfig().aiRoot, CALENDAR_FILE)
}

function store(): void {
  const p = storePath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(events, null, 2), 'utf-8')
}

function load(): void {
  const p = storePath()
  if (!existsSync(p)) return
  try {
    events = JSON.parse(readFileSync(p, 'utf-8')) as CalendarEvent[]
    if (!Array.isArray(events)) events = []
  } catch {
    events = []
  }
}

function init(): void {
  if (inited) return
  inited = true
  load()
}

export function listEvents(from: number, to?: number): CalendarEvent[] {
  init()
  return events
    .filter((e) => e.start >= from && (to === undefined || e.start <= to))
    .sort((a, b) => a.start - b.start)
}

export function listUpcoming(limit = 10): CalendarEvent[] {
  return listEvents(Date.now()).slice(0, limit)
}

export function addEvent(input: {
  title: string
  start: number
  end?: number
  notes?: string
}): CalendarEvent | null {
  init()
  if (!input.title.trim()) return null
  const ev: CalendarEvent = {
    id: randomUUID(),
    title: input.title.trim(),
    start: input.start,
    end: input.end,
    notes: input.notes?.trim(),
    createdAt: Date.now()
  }
  events.push(ev)
  store()
  activity.log('calendar', `Event added: ${ev.title}`)
  return ev
}

export function updateEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>): CalendarEvent | null {
  init()
  const ev = events.find((e) => e.id === id)
  if (!ev) return null
  Object.assign(ev, patch)
  store()
  activity.log('calendar', `Event updated: ${ev.title}`)
  return ev
}

export function removeEvent(id: string): boolean {
  init()
  const before = events.length
  events = events.filter((e) => e.id !== id)
  if (events.length !== before) {
    store()
    activity.log('calendar', 'Event removed')
    return true
  }
  return false
}

/** Parse a natural "when" phrase into an epoch timestamp. Day and time order-independent. */
export function parseWhen(text: string): number | null {
  const t = text.trim().toLowerCase()
  const now = new Date()

  const rel = t.match(/^(in|after)\s+(\d+)\s*(minute|min|hour|hr|day)s?\b/i)
  if (rel) {
    const unitMs: Record<string, number> = { minute: 60000, min: 60000, hour: 3600000, hr: 3600000, day: 86400000 }
    return now.getTime() + Number(rel[2]) * unitMs[rel[3].toLowerCase()]
  }

  const d = new Date()
  if (/today\b/.test(t)) {
    d.setHours(0, 0, 0, 0)
  } else if (/tomorrow\b/.test(t)) {
    d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
  } else {
    const nextDay = t.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
    if (nextDay) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const target = days.indexOf(nextDay[1])
      const cur = d.getDay()
      let delta = (target - cur + 7) % 7
      if (delta === 0) delta = 7
      d.setDate(d.getDate() + delta)
      d.setHours(0, 0, 0, 0)
    } else if (/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.test(t)) {
      // bare time → today
      d.setHours(0, 0, 0, 0)
    } else {
      return null
    }
  }

  const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (time) {
    let hour = Number(time[1]) % 12
    if (time[3].toLowerCase() === 'pm') hour += 12
    d.setHours(hour, Number(time[2] ?? 0), 0, 0)
  }

  if (d.getTime() <= Date.now() && /today\b/.test(t) && !/^in\b/i.test(t)) {
    d.setDate(d.getDate() + 1)
  }
  return d.getTime()
}