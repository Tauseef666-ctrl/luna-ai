import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ActivityEvent, ActivityLevel } from '../shared/types'

const MAX_EVENTS = 500

class ActivityStore {
  private events: ActivityEvent[] = []
  private file = ''

  init(root: string): void {
    this.file = join(root, 'memory', 'luna-activity.json')
    this.load()
  }

  private load(): void {
    if (!this.file || !existsSync(this.file)) return
    try {
      this.events = JSON.parse(readFileSync(this.file, 'utf-8')) as ActivityEvent[]
    } catch {
      this.events = []
    }
  }

  private persist(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.events, null, 2), 'utf-8')
  }

  log(source: string, message: string, level: ActivityLevel = 'info'): void {
    this.events.unshift({ id: randomUUID(), ts: Date.now(), level, source, message })
    if (this.events.length > MAX_EVENTS) this.events = this.events.slice(0, MAX_EVENTS)
    this.persist()
  }

  list(limit = 100): ActivityEvent[] {
    return this.events.slice(0, limit)
  }

  clear(): number {
    const n = this.events.length
    this.events = []
    this.persist()
    return n
  }
}

export const activity = new ActivityStore()
