import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LunaConfig } from '../shared/types'

const DEFAULT_SYSTEM_PROMPT =
  'You are LUNA, a warm, gentle, intelligent, patient AI companion living on this PC. ' +
  'You are helpful, honest about your limits, and never pretend a failed action succeeded. ' +
  'Reply concisely and naturally, as if speaking to a friend.'

const DEFAULTS: LunaConfig = {
  aiRoot: 'D:\\own-ai',
  ollamaUrl: 'http://localhost:11434',
  theme: 'dark',
  wakeWordEnabled: false,
  pushToTalk: true,
  activeProject: '',
  activeAi: 'luna',
  character: {
    luna: { model: '', idle: '', speaking: '' },
    shoya: { model: '', idle: '', speaking: '' }
  },
  chat: {
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: DEFAULT_SYSTEM_PROMPT
  },
  tts: {
    enabled: true,
    autoSpeak: true,
    lengthScale: 1
  },
  voice: {
    language: 'en',
    micDevice: '',
    mode: 'ptt',
    sensitivity: 0.5
  },
  float: {
    width: 360,
    height: 520,
    clickThrough: false,
    opacity: 1
  },
  automation: {
    confirm: true,
    proactive: false
  },
  memory: {
    sessionDays: 7,
    autoSave: false,
    askBeforeDelete: true
  },
  voiceId: {
    enabled: false,
    guest: false
  },
  background: {
    startWithWindows: false,
    startMinimized: false,
    hotkey: 'CommandOrControl+Shift+Space'
  },
  providers: {
    ollama: {
      id: 'ollama',
      kind: 'ollama',
      label: 'Ollama (Local)',
      baseUrl: 'http://localhost:11434',
      model: '',
      apiKeyRef: '',
      enabled: true,
      priority: 0
    }
  }
}

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepClone<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => deepClone(x)) as unknown as T
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = deepClone(val)
    return out as unknown as T
  }
  return v
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    if (override === undefined || override === null) return deepClone(base)
    return override as T
  }
  const out: Record<string, unknown> = {}
  const ov = override as Record<string, unknown>
  for (const [k, bv] of Object.entries(base)) out[k] = deepMerge(bv, ov[k])
  for (const k of Object.keys(ov)) if (!(k in out)) out[k] = deepClone(ov[k])
  return out as T
}

export function loadConfig(): LunaConfig {
  const p = configPath()
  if (existsSync(p)) {
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<LunaConfig>
      return deepMerge(DEFAULTS, parsed)
    } catch {
      // corrupted config falls back to defaults
    }
  }
  return deepMerge(DEFAULTS, {})
}

export function saveConfig(cfg: LunaConfig): void {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}
