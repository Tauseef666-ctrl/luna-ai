export interface LunaConfig {
  aiRoot: string
  ollamaUrl: string
  theme: 'dark' | 'light'
  wakeWordEnabled: boolean
  pushToTalk: boolean
  character: {
    luna: { model: string; idle: string; speaking: string }
    shoya: { model: string; idle: string; speaking: string }
  }
  providers: Record<string, unknown>
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

export type CharState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working'

export type AiStatus = 'online' | 'offline' | 'unknown'

export interface AppState {
  char: CharState
  status: string
  subtitle: string
  luna: AiStatus
  shoya: AiStatus
  activeModel: string
}
