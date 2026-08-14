import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ChatTurn, LunaSession, MemoryEntry, MemoryTier } from '../shared/types'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SHORT_MAX = 24

class MemoryStore {
  private entries: MemoryEntry[] = []
  private file = ''

  init(root: string): void {
    this.file = join(root, 'memory', 'luna-memory.json')
    this.load()
    this.pruneExpired()
  }

  private load(): void {
    if (!this.file || !existsSync(this.file)) return
    try {
      this.entries = JSON.parse(readFileSync(this.file, 'utf-8')) as MemoryEntry[]
    } catch {
      this.entries = []
    }
  }

  private persist(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.entries, null, 2), 'utf-8')
  }

  pruneExpired(): number {
    const now = Date.now()
    const before = this.entries.length
    this.entries = this.entries.filter((e) => !e.expiresAt || e.expiresAt > now)
    if (this.entries.length !== before) this.persist()
    return before - this.entries.length
  }

  list(): MemoryEntry[] {
    return [...this.entries].sort((a, b) => b.createdAt - a.createdAt)
  }

  add(input: {
    tier: MemoryTier
    text: string
    project?: string
    tags?: string[]
    saved?: boolean
  }): MemoryEntry {
    const now = Date.now()
    const saved = input.saved ?? false
    const entry: MemoryEntry = {
      id: randomUUID(),
      tier: input.tier,
      text: input.text.trim(),
      project: input.project,
      tags: (input.tags ?? []).slice(0, 8),
      saved,
      createdAt: now,
      expiresAt: input.tier === 'session' && !saved ? now + SESSION_TTL_MS : undefined
    }
    if (entry.tier === 'short') {
      this.entries = this.entries.filter((e) => e.tier !== 'short')
    }
    this.entries.push(entry)
    if (entry.tier === 'short' && this.entries.filter((e) => e.tier === 'short').length > SHORT_MAX) {
      this.entries = this.entries.filter((e, i, a) => e.tier !== 'short' || i >= a.length - SHORT_MAX)
    }
    this.persist()
    return entry
  }

  pin(id: string, saved: boolean): boolean {
    const e = this.entries.find((x) => x.id === id)
    if (!e) return false
    e.saved = saved
    e.expiresAt = saved || e.tier !== 'session' ? undefined : Date.now() + SESSION_TTL_MS
    this.persist()
    return true
  }

  search(query: string, limit = 8): MemoryEntry[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1)
    if (terms.length === 0) return []
    return this.entries
      .map((e) => {
        const hay = `${e.text} ${(e.tags ?? []).join(' ')} ${e.project ?? ''}`.toLowerCase()
        const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
        return { e, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.e.createdAt - a.e.createdAt)
      .slice(0, limit)
      .map((r) => r.e)
  }

  recall(query: string, limit = 4): string {
    const hits = this.search(query, limit)
    if (hits.length === 0) return ''
    return hits.map((e) => `[${e.tier}${e.project ? `:${e.project}` : ''}] ${e.text}`).join('\n')
  }

  delete(id: string): boolean {
    const before = this.entries.length
    this.entries = this.entries.filter((e) => e.id !== id)
    if (this.entries.length !== before) {
      this.persist()
      return true
    }
    return false
  }

  clear(tier?: MemoryTier): number {
    const before = this.entries.length
    this.entries = tier ? this.entries.filter((e) => e.tier !== tier) : []
    if (this.entries.length !== before) this.persist()
    return before - this.entries.length
  }

  export(): string {
    return JSON.stringify(this.entries, null, 2)
  }
}

export const memory = new MemoryStore()

const UNUSED_TTL_MS = 7 * 24 * 60 * 60 * 1000
const HISTORY_MAX = 48

function defaultSessionName(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `Chat ${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

export class SessionStore {
  private sessions: LunaSession[] = []
  private file = ''

  init(root: string): void {
    this.file = join(root, 'memory', 'luna-sessions.json')
    this.load()
    this.pruneExpired()
  }

  private load(): void {
    if (!this.file || !existsSync(this.file)) return
    try {
      this.sessions = JSON.parse(readFileSync(this.file, 'utf-8')) as LunaSession[]
    } catch {
      this.sessions = []
    }
  }

  private persist(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.sessions, null, 2), 'utf-8')
  }

  pruneExpired(): number {
    const now = Date.now()
    const before = this.sessions.length
    this.sessions = this.sessions.filter((s) => s.saved || now - s.updatedAt < UNUSED_TTL_MS)
    if (this.sessions.length !== before) this.persist()
    return before - this.sessions.length
  }

  list(): LunaSession[] {
    return [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): LunaSession | undefined {
    return this.sessions.find((s) => s.id === id)
  }

  create(name?: string): LunaSession {
    const now = Date.now()
    const s: LunaSession = {
      id: randomUUID(),
      name: name?.trim() || defaultSessionName(new Date(now)),
      saved: false,
      createdAt: now,
      updatedAt: now,
      turns: []
    }
    this.sessions.unshift(s)
    this.persist()
    return s
  }

  appendTurn(id: string, role: ChatTurn['role'], content: string): void {
    const s = this.get(id)
    if (!s) return
    s.turns.push({ role, content, ts: Date.now() })
    if (s.turns.length > HISTORY_MAX) s.turns = s.turns.slice(-HISTORY_MAX)
    s.updatedAt = Date.now()
    this.persist()
  }

  history(id: string, maxTurns = 12): ChatTurn[] {
    const s = this.get(id)
    if (!s) return []
    return s.turns.slice(-maxTurns)
  }

  rename(id: string, name: string): boolean {
    const s = this.get(id)
    if (!s || !name.trim()) return false
    s.name = name.trim()
    this.persist()
    return true
  }

  save(id: string): boolean {
    const s = this.get(id)
    if (!s) return false
    s.saved = true
    this.persist()
    return true
  }

  unsave(id: string): boolean {
    const s = this.get(id)
    if (!s) return false
    s.saved = false
    s.updatedAt = Date.now()
    this.persist()
    return true
  }

  remove(id: string): boolean {
    const before = this.sessions.length
    this.sessions = this.sessions.filter((s) => s.id !== id)
    if (this.sessions.length !== before) {
      this.persist()
      return true
    }
    return false
  }
}

export const sessions = new SessionStore()
