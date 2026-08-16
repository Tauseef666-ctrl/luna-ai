import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ProviderConfig, ProviderStatus } from '../shared/types'
import { loadConfig } from './config'

export type ProviderChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ProviderChatOptions {
  temperature?: number
  maxTokens?: number
}

// ---------------------------------------------------------------------------
// Encrypted credential store (Credential Manager via DPAPI on Windows).
// Keys are never written to config.json — only an apiKeyRef handle is stored.
// ---------------------------------------------------------------------------

function appDataDir(): string {
  const cfg = loadConfig()
  return join(cfg.aiRoot, '.luna')
}

function secretsPath(): string {
  return join(appDataDir(), 'secrets.bin')
}

export function setSecret(key: string, value: string): boolean {
  try {
    const dir = secretsPath()
    mkdirSync(dirname(dir), { recursive: true })
    const map = readSecrets()
    map[key] = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value).toString('base64')
      : Buffer.from(value, 'utf8').toString('base64')
    writeFileSync(dir, JSON.stringify(map), 'utf8')
    return true
  } catch {
    return false
  }
}

export function getSecret(key: string): string | null {
  try {
    const raw = readSecrets()[key]
    if (!raw) return null
    const buf = Buffer.from(raw, 'base64')
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
    return buf.toString('utf8')
  } catch {
    return null
  }
}

export function deleteSecret(key: string): boolean {
  try {
    const map = readSecrets()
    if (!(key in map)) return true
    delete map[key]
    writeFileSync(secretsPath(), JSON.stringify(map), 'utf8')
    return true
  } catch {
    return false
  }
}

function readSecrets(): Record<string, string> {
  try {
    if (existsSync(secretsPath())) {
      return JSON.parse(readFileSync(secretsPath(), 'utf8')) as Record<string, string>
    }
  } catch {
    // corrupt secret file — start fresh
  }
  return {}
}

// ---------------------------------------------------------------------------
// Unified provider chat + connection test.
// ---------------------------------------------------------------------------

export interface TestResult {
  ok: boolean
  latencyMs: number
  detail: string
  models: string[]
}

function apiKeyFor(p: ProviderConfig): string | null {
  if (!p.apiKeyRef) return null
  return getSecret(p.apiKeyRef)
}

export async function testConnection(p: ProviderConfig): Promise<TestResult> {
  const started = Date.now()
  try {
    switch (p.kind) {
      case 'ollama':
        return await testOllama(p)
      case 'gemini':
        return await testGemini(p)
      case 'claude':
        return await testClaude(p)
      case 'openai':
        return await testOpenAI(p)
      default:
        return { ok: false, latencyMs: 0, detail: `Unsupported provider kind: ${p.kind}`, models: [] }
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: (err as Error).message,
      models: []
    }
  }
}

async function testOllama(p: ProviderConfig): Promise<TestResult> {
  const started = Date.now()
  const base = p.baseUrl ?? 'http://localhost:11434'
  const res = await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`Ollama responded with HTTP ${res.status}`)
  const tags = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) })
  const models: string[] = []
  if (tags.ok) {
    const data = (await tags.json()) as { models?: Array<{ name: string }> }
    models.push(...(data.models ?? []).map((m) => m.name))
  }
  return { ok: true, latencyMs: Date.now() - started, detail: 'Ollama reachable', models }
}

async function testGemini(p: ProviderConfig): Promise<TestResult> {
  const started = Date.now()
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set (set it in Settings → AI Models)')
  const base = p.baseUrl ?? 'https://generativelanguage.googleapis.com'
  const model = p.model || 'gemini-2.0-flash'
  const url = `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`Gemini responded with HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { ok: true, latencyMs: Date.now() - started, detail: `Gemini model "${model}" reachable`, models: [model] }
}

async function testClaude(p: ProviderConfig): Promise<TestResult> {
  const started = Date.now()
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set (set it in Settings → AI Models)')
  const base = p.baseUrl ?? 'https://api.anthropic.com'
  const model = p.model || 'claude-sonnet-4-20250514'
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'ping' }] }),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`Claude responded with HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { ok: true, latencyMs: Date.now() - started, detail: `Claude model "${model}" reachable`, models: [model] }
}

async function testOpenAI(p: ProviderConfig): Promise<TestResult> {
  const started = Date.now()
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set (set it in Settings → AI Models)')
  const base = p.baseUrl ?? 'https://api.openai.com/v1'
  const model = p.model || 'gpt-4o-mini'
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'ping' }] }),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`OpenAI-compatible endpoint responded with HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { ok: true, latencyMs: Date.now() - started, detail: `OpenAI-compatible model "${model}" reachable`, models: [model] }
}

// ---------------------------------------------------------------------------
// Unified chat completion across providers.
// ---------------------------------------------------------------------------

export async function providerChat(
  p: ProviderConfig,
  messages: ProviderChatMessage[],
  opts: ProviderChatOptions = {}
): Promise<string> {
  switch (p.kind) {
    case 'ollama':
      return chatOllama(p, messages, opts)
    case 'gemini':
      return chatGemini(p, messages, opts)
    case 'claude':
      return chatClaude(p, messages, opts)
    case 'openai':
      return chatOpenAI(p, messages, opts)
    default:
      throw new Error(`Unsupported provider kind: ${p.kind}`)
  }
}

async function chatOllama(p: ProviderConfig, messages: ProviderChatMessage[], opts: ProviderChatOptions): Promise<string> {
  const base = p.baseUrl ?? 'http://localhost:11434'
  const body: Record<string, unknown> = { model: p.model, messages, stream: false }
  const options: Record<string, unknown> = {}
  if (opts.temperature !== undefined) options.temperature = opts.temperature
  if (opts.maxTokens !== undefined) options.num_predict = opts.maxTokens
  if (Object.keys(options).length) body.options = options
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = (await res.json()) as { message?: { content?: string } }
  const content = data.message?.content ?? ''
  if (!content) throw new Error('Empty response from Ollama')
  return content
}

async function chatGemini(p: ProviderConfig, messages: ProviderChatMessage[], opts: ProviderChatOptions): Promise<string> {
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set')
  const base = p.baseUrl ?? 'https://generativelanguage.googleapis.com'
  const model = p.model || 'gemini-2.0-flash'
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const body: Record<string, unknown> = { contents }
  if (opts.temperature !== undefined) body.generationConfig = { temperature: opts.temperature }
  const url = `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

async function chatClaude(p: ProviderConfig, messages: ProviderChatMessage[], opts: ProviderChatOptions): Promise<string> {
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set')
  const base = p.baseUrl ?? 'https://api.anthropic.com'
  const model = p.model || 'claude-sonnet-4-20250514'
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n') || undefined
  const convo = messages.filter((m) => m.role !== 'system')
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: convo
  }
  if (system) body.system = system
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Claude error ${res.status}`)
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? ''
  if (!text) throw new Error('Empty response from Claude')
  return text
}

async function chatOpenAI(p: ProviderConfig, messages: ProviderChatMessage[], opts: ProviderChatOptions): Promise<string> {
  const key = apiKeyFor(p)
  if (!key) throw new Error('API key not set')
  const base = p.baseUrl ?? 'https://api.openai.com/v1'
  const model = p.model || 'gpt-4o-mini'
  const body: Record<string, unknown> = { model, messages }
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`OpenAI-compatible error ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('Empty response')
  return content
}

// ---------------------------------------------------------------------------
// Status for all configured providers.
// ---------------------------------------------------------------------------

export async function providerStatuses(): Promise<ProviderStatus[]> {
  const cfg = loadConfig()
  const entries = Object.values(cfg.providers)
    .filter((p): p is ProviderConfig => Boolean(p))
    .sort((a, b) => a.priority - b.priority)
  const results = await Promise.all(
    entries.map(async (p): Promise<ProviderStatus> => {
      const started = Date.now()
      const r = await testConnection(p)
      return {
        id: p.id,
        kind: p.kind,
        label: p.label,
        model: p.model,
        enabled: p.enabled,
        ok: r.ok,
        latencyMs: Date.now() - started,
        detail: r.detail,
        models: r.models
      }
    })
  )
  return results
}

export function enabledProviders(): ProviderConfig[] {
  const cfg = loadConfig()
  return Object.values(cfg.providers)
    .filter((p): p is ProviderConfig => Boolean(p))
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority)
}
