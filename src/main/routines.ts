import { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Routine, RoutinePayload } from '../shared/types'
import { activity } from './activity'
import { loadConfig } from './config'
import { speakTo } from './tts'

const ROUTINES_FILE = 'memory/routines.json'
const TICK_MS = 30 * 1000

let routines: Routine[] = []
let inited = false
let timer: NodeJS.Timeout | null = null

function storePath(): string {
  return join(loadConfig().aiRoot, ROUTINES_FILE)
}

function store(): void {
  const p = storePath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(routines, null, 2), 'utf-8')
}

function load(): void {
  const p = storePath()
  if (!existsSync(p)) return
  try {
    routines = JSON.parse(readFileSync(p, 'utf-8')) as Routine[]
    if (!Array.isArray(routines)) routines = []
  } catch {
    routines = []
  }
}

function init(): void {
  if (inited) return
  inited = true
  load()
}

export function listRoutines(): Routine[] {
  init()
  return routines
}

export function addRoutine(input: Omit<Routine, 'id' | 'createdAt' | 'enabled' | 'lastFired'>): Routine {
  init()
  const r: Routine = {
    ...input,
    id: randomUUID(),
    enabled: true,
    createdAt: Date.now()
  }
  routines.push(r)
  store()
  activity.log('routine', `Reminder set: ${r.text}`)
  return r
}

export function removeRoutine(id: string): boolean {
  init()
  const before = routines.length
  routines = routines.filter((r) => r.id !== id)
  if (routines.length !== before) {
    store()
    activity.log('routine', 'Reminder removed')
    return true
  }
  return false
}

export function toggleRoutine(id: string, enabled: boolean): Routine | null {
  init()
  const r = routines.find((x) => x.id === id)
  if (!r) return null
  r.enabled = enabled
  store()
  return r
}

// ---------- time parsing ----------

const TWO_DIGIT = /^([01]?\d|2[0-3])[:.](\d{2})\b/
const HOURS12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i

function parseTimeHHMM(time: string): number | null {
  // returns epoch ms for the given clock time today; null if unparseable
  const m = time.match(TWO_DIGIT)
  if (m) {
    const d = new Date()
    d.setHours(Number(m[1]), Number(m[2]), 0, 0)
    return d.getTime()
  }
  const h = time.match(HOURS12)
  if (h) {
    let hour = Number(h[1]) % 12
    if (h[3].toLowerCase() === 'pm') hour += 12
    const min = h[2] ? Number(h[2]) : 0
    const d = new Date()
    d.setHours(hour, min, 0, 0)
    return d.getTime()
  }
  return null
}

/**
 * Parse a user phrase into a routine. Accepts:
 *   "in 2 hours" / "in 30 minutes" / "in 45s"
 *   "at 9am" / "at 9:30pm" / "at 14:00"
 *   "every day at 9am" / "every weekday at 9am" / "daily at 9am"
 * Returns null when the phrase carries no recognizable schedule.
 */
export function parseRoutine(text: string): Omit<Routine, 'id' | 'createdAt' | 'enabled' | 'lastFired'> | null {
  const t = text.trim()
  const rel = t.match(/^in\s+(\d+)\s*(second|sec|minute|min|hour|hr|day)s?\b/i)
  if (rel) {
    const unitMs: Record<string, number> = {
      second: 1000, sec: 1000, minute: 60000, min: 60000, hour: 3600000, hr: 3600000, day: 86400000
    }
    const base = unitMs[rel[2].toLowerCase()]
    return {
      kind: 'reminder',
      text: t,
      schedule: { type: 'once', date: Date.now() + Number(rel[1]) * base }
    }
  }

  const every = t.match(/^every\s+(day|weekday|morning|afternoon)\s+(?:at\s+)?(.+)$/i) ||
    t.match(/^(daily)\s+(?:at\s+)?(.+)$/i)
  if (every) {
    const timespec = every[2].trim()
    const ms = parseTimeHHMM(timespec)
    if (ms !== null) {
      const when = every[1].toLowerCase()
      const d = new Date(ms)
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      return {
        kind: 'reminder',
        text: t,
        schedule: { type: when === 'weekday' ? 'weekdays' : 'daily', time }
      }
    }
    return null
  }

  const morning = t.match(/^every\s+(morning|afternoon)\b/i)
  if (morning) {
    const hour = morning[1].toLowerCase() === 'morning' ? '09:00' : '15:00'
    return {
      kind: 'reminder',
      text: t,
      schedule: { type: 'daily', time: hour }
    }
  }

  const at = t.match(/^at\s+(.+)$/i)
  if (at) {
    const ms = parseTimeHHMM(at[1].trim())
    if (ms !== null)
      return { kind: 'reminder', text: t, schedule: { type: 'once', date: ms } }
  }

  return null
}

// ---------- quiet hours ----------

function toMinutes(time: string): number {
  const m = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

function isQuiet(now: Date, start: string, end: string): boolean {
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === e) return false
  return s < e ? cur >= s && cur < e : cur >= s || cur < e
}

// ---------- firing ----------

function nextOccurrenceMs(schedule: Routine['schedule']): number | null {
  if (schedule.type === 'once') return schedule.date ?? null
  const t = schedule.time ?? '09:00'
  const m = t.match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  const now = new Date()
  let d = new Date()
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (d.getTime() <= now.getTime()) d = new Date(d.getTime() + 86400000)
  if (schedule.type === 'weekdays') {
    let guard = 0
    while (d.getDay() === 0 || d.getDay() === 6) {
      d = new Date(d.getTime() + 86400000)
      if (++guard > 8) break
    }
  }
  return d.getTime()
}

function fire(now: number, r: Routine): void {
  const cfg = loadConfig()
  const quiet = isQuiet(new Date(now), cfg.automation.quietStart, cfg.automation.quietEnd)

  const payload: RoutinePayload = { id: r.id, kind: r.kind, text: r.text, quiet }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('proactive:routine', payload)
  }

  activity.log('routine', `Routine fired: ${r.text}`, quiet ? 'info' : 'success')

  if (!quiet && cfg.tts.enabled) {
    speakTo(null, r.text, cfg.character.luna.speaking)
  }
}

export function tick(): void {
  init()
  const now = Date.now()
  const firedIds: string[] = []
  for (const r of routines) {
    if (!r.enabled) continue
    if (r.schedule.type === 'once') {
      const at = r.schedule.date ?? 0
      if (now >= at) {
        fire(now, r)
        firedIds.push(r.id)
      }
    } else {
      const last = r.lastFired ?? 0
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      const due = nextOccurrenceMs(r.schedule)
      if (due !== null && due <= now && last < dayStart.getTime()) {
        fire(now, r)
        r.lastFired = now
      }
    }
  }
  if (firedIds.length > 0) {
    routines = routines.filter((r) => !firedIds.includes(r.id))
    store()
  }
  if (routines.some((r) => r.lastFired !== undefined)) store()
}

export function startScheduler(): void {
  init()
  if (timer) return
  timer = setInterval(tick, TICK_MS)
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}