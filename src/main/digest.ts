import { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DigestPayload, DigestItem } from '../shared/types'
import { activity } from './activity'
import { loadConfig } from './config'

const WATERMARK_FILE = 'memory/digest-watermark.json'

let watermark = Date.now() - 24 * 60 * 60 * 1000
let inited = false

function wmPath(): string {
  const root = loadConfig().aiRoot
  return join(root, WATERMARK_FILE)
}

function loadWatermark(): void {
  const p = wmPath()
  if (!existsSync(p)) return
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8')) as { ts?: number }
    if (typeof data.ts === 'number' && data.ts > 0) watermark = data.ts
  } catch { /* corrupted → keep default */ }
}

function saveWatermark(ts: number): void {
  const p = wmPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify({ ts }, null, 2), 'utf-8')
}

function init(): void {
  if (inited) return
  inited = true
  loadWatermark()
}

const DIGEST_SOURCES = new Set(['automation', 'skill', 'shoya', 'research', 'background', 'routine', 'reminder'])

function classifyEvent(source: string, level: string, _message: string): DigestItem['kind'] | null {
  if (level === 'error') return 'error'
  if (!DIGEST_SOURCES.has(source)) return null
  if (source === 'reminder') return 'reminder'
  if (source === 'routine' || source === 'background') return 'routine'
  return 'task'
}

export function buildDigest(): DigestPayload | null {
  init()
  const cutoff = watermark
  const now = Date.now()
  const events = activity.list(200).filter((e) => e.ts > cutoff && e.ts <= now)

  const items: DigestItem[] = []
  for (const ev of events) {
    const kind = classifyEvent(ev.source, ev.level, ev.message)
    if (kind) items.push({ title: ev.message, kind })
    if (items.length >= 6) break
  }

  if (items.length === 0) return null

  const counts = { task: 0, reminder: 0, routine: 0, error: 0 }
  for (const it of items) counts[it.kind]++

  const parts: string[] = []
  if (counts.task > 0) parts.push(`${counts.task} task${counts.task > 1 ? 's' : ''} completed`)
  if (counts.reminder > 0) parts.push(`${counts.reminder} reminder${counts.reminder > 1 ? 's' : ''} fired`)
  if (counts.routine > 0) parts.push(`${counts.routine} routine${counts.routine > 1 ? 's' : ''} ran`)
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error > 1 ? 's' : ''} needs your attention`)

  const summary = parts.join(', ') + '.'
  return { summary, items }
}

export function emitDigest(force = false): DigestPayload | null {
  const cfg = loadConfig()
  if (!force && !cfg.digest?.enabled) return null
  const payload = buildDigest()
  if (!payload) return null

  const now = Date.now()
  saveWatermark(now)
  watermark = now

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('notification:digest', payload)
  }
  return payload
}
