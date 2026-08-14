import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LunaConfig } from '../shared/types'

const DEFAULTS: LunaConfig = {
  aiRoot: 'D:\\own-ai',
  ollamaUrl: 'http://localhost:11434',
  theme: 'dark',
  wakeWordEnabled: false,
  pushToTalk: true,
  character: {
    luna: { model: '', idle: '', speaking: '' },
    shoya: { model: '', idle: '', speaking: '' }
  },
  providers: {}
}

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): LunaConfig {
  const p = configPath()
  if (existsSync(p)) {
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<LunaConfig>
      return { ...DEFAULTS, ...parsed }
    } catch {
      // corrupted config falls back to defaults
    }
  }
  return { ...DEFAULTS }
}

export function saveConfig(cfg: LunaConfig): void {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}
