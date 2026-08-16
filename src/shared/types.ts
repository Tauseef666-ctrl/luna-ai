export type CharId = 'luna' | 'shoya'

export interface LunaConfig {
  aiRoot: string
  ollamaUrl: string
  theme: 'dark' | 'light'
  wakeWordEnabled: boolean
  pushToTalk: boolean
  activeProject: string
  activeAi: CharId
  character: {
    luna: { model: string; idle: string; speaking: string }
    shoya: { model: string; idle: string; speaking: string }
  }
  chat: {
    temperature: number
    maxTokens: number
    systemPrompt: string
  }
  tts: {
    enabled: boolean
    autoSpeak: boolean
    lengthScale: number
  }
  voice: {
    language: 'en' | 'hi' | 'ur' | 'hinglish'
    micDevice: string
    mode: 'ptt' | 'always' | 'wake'
    sensitivity: number
  }
  float: {
    width: number
    height: number
    clickThrough: boolean
    opacity: number
  }
  automation: {
    confirm: boolean
    proactive: boolean
  }
  memory: {
    sessionDays: number
    autoSave: boolean
    askBeforeDelete: boolean
  }
  voiceId: {
    enabled: boolean
    guest: boolean
  }
  background: {
    startWithWindows: boolean
    startMinimized: boolean
    hotkey: string
  }
  providers: Record<string, ProviderConfig>
}

export type ProviderKind = 'ollama' | 'gemini' | 'claude' | 'openai'

export interface ProviderConfig {
  id: string
  kind: ProviderKind
  label: string
  baseUrl?: string
  model: string
  apiKeyRef: string
  enabled: boolean
  priority: number
}

export interface ProviderStatus {
  id: string
  kind: ProviderKind
  label: string
  model: string
  enabled: boolean
  ok: boolean
  latencyMs: number
  detail: string
  models: string[]
}

export interface ShoyaDetection {
  found: boolean
  command: string
  version: string
  source: 'path' | 'npm' | 'known-dir' | 'vscode'
}

export interface ShoyaRunResult {
  ok: boolean
  backend: 'opencode' | 'provider'
  providerId: string
  output: string
  durationMs: number
  truncated: boolean
}

export type RouterTarget =
  | 'luna-local'
  | 'luna-online'
  | 'shoya'
  | 'windows'
  | 'vscode'
  | 'file'
  | 'memory'
  | 'research'
  | 'chat'

export interface RouteResult {
  target: RouterTarget
  ok: boolean
  output: string
  providerId: string
}

export interface GitStatusLine {
  status: string
  file: string
}

export interface CodingContext {
  project: string
  path: string
  exists: boolean
  git: {
    isRepo: boolean
    branch: string
    changes: GitStatusLine[]
  } | null
  tree: string[]
  summary: {
    sourceFiles: number
    totalLines: number
    latestChanged: string[]
  }
}

export interface VscodeStatus {
  installed: boolean
  command: string
  version: string
}

export interface ResearchSource {
  title: string
  url: string
  snippet: string
}

export interface ResearchResult {
  ok: boolean
  online: boolean
  offline: boolean
  query: string
  sources: ResearchSource[]
  summary: string
  error?: string
}

export interface NewsItem {
  topic: string
  title: string
  url: string
  summary: string
}

export interface NewsResult {
  ok: boolean
  online: boolean
  items: NewsItem[]
  error?: string
}

export interface Asset {
  name: string
  path: string
  kind: string
  size: number
}

export interface ScanResult {
  root: string
  exists: boolean
  llm: Asset[]
  embedding: Asset[]
  stt: Asset[]
  tts: Asset[]
  wakeword: Asset[]
  characters: Asset[]
  animations: Asset[]
  reference: Asset[]
  projects: Asset[]
  warnings: string[]
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
}

export type MemoryTier = 'short' | 'session' | 'long' | 'project'

export interface MemoryEntry {
  id: string
  tier: MemoryTier
  text: string
  project?: string
  tags: string[]
  saved: boolean
  createdAt: number
  expiresAt?: number
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface LunaSession {
  id: string
  name: string
  saved: boolean
  createdAt: number
  updatedAt: number
  turns: ChatTurn[]
}

export type CharState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'confused'
  | 'working'
  | 'coding'
  | 'searching'
  | 'explaining'
  | 'pointing'
  | 'waiting'
  | 'error'
  | 'success'
  | 'goodbye'

export type AiStatus = 'online' | 'offline' | 'unknown'

export interface AppState {
  char: CharState
  status: string
  subtitle: string
  luna: AiStatus
  shoya: AiStatus
  activeModel: string
}

export interface WindowInfo {
  pid: number
  app: string
  title: string
}

export interface CommandResult {
  ok: boolean
  confirmed: boolean
  output: string
}

export type ActivityLevel = 'info' | 'success' | 'warn' | 'error'

export interface ActivityEvent {
  id: string
  ts: number
  level: ActivityLevel
  source: string
  message: string
}

export interface ProjectInfo {
  name: string
  path: string
  createdAt: number
  updatedAt: number
}

export interface TtsStatus {
  available: boolean
  engine: 'piper' | 'none'
  voice: string
  sampleRate: number
  settings: { enabled: boolean; autoSpeak: boolean; lengthScale: number }
}

export interface TtsAudioPayload {
  wavBase64: string
  sampleRate: number
}

// ---------- shared contract (AGENTS.md) ----------

export interface CharacterStatePayload {
  character: CharId
  state: CharState
}

export interface LipsyncPayload {
  character: CharId
  visemeStream: number[]
}

export interface SubtitlePayload {
  character: CharId
  text: string
}

export interface PointPayload {
  character: CharId
  targetX: number
  targetY: number
}

export interface AiSwitchPayload {
  active: CharId
}

export interface PermissionRequest {
  action: string
  tier: 'safe' | 'confirm'
  detail?: string
}

export interface PermissionResolved {
  action: string
  approved: boolean
}

export interface DigestItem {
  title: string
  kind: 'task' | 'reminder' | 'routine' | 'error'
}

export interface DigestPayload {
  summary: string
  items: DigestItem[]
}

export interface VoiceInputPayload {
  text: string
  language: string
}

export interface PointDemoPayload {
  targetX: number
  targetY: number
}
