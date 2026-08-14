import type { LunaBridge } from '../../preload'
import type {
  AppState,
  LunaConfig,
  LunaSession,
  MemoryEntry,
  MemoryTier,
  OllamaModel,
  ScanResult
} from '../../shared/types'

const MS = 1000
const now = Date.now()

const SAMPLE_STATE: AppState = {
  char: 'idle',
  status: 'Ready to assist...',
  subtitle: '',
  luna: 'online',
  shoya: 'offline',
  activeModel: 'qwen2.5:7b'
}

const SAMPLE_CONFIG: LunaConfig = {
  aiRoot: 'D:\\own-ai',
  ollamaUrl: 'http://localhost:11434',
  theme: 'dark',
  wakeWordEnabled: false,
  pushToTalk: true,
  character: {
    luna: { model: 'qwen2.5:7b', idle: '', speaking: 'en_US-amy' },
    shoya: { model: 'qwen2.5:3b', idle: '', speaking: 'en_US-ryan' }
  },
  providers: {}
}

const SAMPLE_MODELS: OllamaModel[] = [
  { name: 'qwen2.5:7b', size: 6.7e9, modifiedAt: new Date(now - 2 * 86400 * MS).toISOString() },
  { name: 'qwen2.5:3b', size: 3.1e9, modifiedAt: new Date(now - 3 * 86400 * MS).toISOString() },
  { name: 'qwen2.5:1.5b', size: 1.5e9, modifiedAt: new Date(now - 3 * 86400 * MS).toISOString() },
  { name: 'qwen2.5vl:3b', size: 3.4e9, modifiedAt: new Date(now - 5 * 86400 * MS).toISOString() },
  { name: 'nomic-embed-text', size: 0.27e9, modifiedAt: new Date(now - 6 * 86400 * MS).toISOString() }
]

const SAMPLE_SCAN: ScanResult = {
  root: 'D:\\own-ai',
  exists: true,
  llm: [
    {
      name: 'qwen2.5:1.5b',
      path: 'D:\\own-ai\\models\\ollama\\manifests\\qwen2.5\\1.5b',
      kind: 'ollama',
      size: 0
    },
    {
      name: 'qwen2.5:3b',
      path: 'D:\\own-ai\\models\\ollama\\manifests\\qwen2.5\\3b',
      kind: 'ollama',
      size: 0
    },
    {
      name: 'qwen2.5:7b',
      path: 'D:\\own-ai\\models\\ollama\\manifests\\qwen2.5\\7b',
      kind: 'ollama',
      size: 0
    },
    {
      name: 'qwen2.5vl:3b',
      path: 'D:\\own-ai\\models\\ollama\\manifests\\qwen2.5vl\\3b',
      kind: 'ollama',
      size: 0
    }
  ],
  embedding: [
    {
      name: 'nomic-embed-text',
      path: 'D:\\own-ai\\models\\ollama\\manifests\\nomic-embed-text',
      kind: 'ollama',
      size: 0
    }
  ],
  stt: [
    { name: 'base', path: 'D:\\own-ai\\models\\whisper\\base\\ggml-base.bin', kind: 'whisper', size: 0 },
    {
      name: 'base.en',
      path: 'D:\\own-ai\\models\\whisper\\base.en\\ggml-base.en.bin',
      kind: 'whisper',
      size: 0
    },
    { name: 'small', path: 'D:\\own-ai\\models\\whisper\\small\\ggml-small.bin', kind: 'whisper', size: 0 }
  ],
  tts: [
    {
      name: 'en_US-amy',
      path: 'D:\\own-ai\\models\\piper\\en_US-amy\\en_US-amy.onnx.json',
      kind: 'piper',
      size: 0
    },
    {
      name: 'en_US-ryan',
      path: 'D:\\own-ai\\models\\piper\\en_US-ryan\\en_US-ryan.onnx.json',
      kind: 'piper',
      size: 0
    },
    {
      name: 'hi_IN-priyamvada',
      path: 'D:\\own-ai\\models\\piper\\hi_IN-priyamvada\\hi_IN-priyamvada.onnx.json',
      kind: 'piper',
      size: 0
    },
    {
      name: 'hi_IN-rohan',
      path: 'D:\\own-ai\\models\\piper\\hi_IN-rohan\\hi_IN-rohan.onnx.json',
      kind: 'piper',
      size: 0
    },
    {
      name: 'ur_PK-aegis_female',
      path: 'D:\\own-ai\\models\\piper\\ur_PK-aegis_female\\ur_PK-aegis_female.onnx.json',
      kind: 'piper',
      size: 0
    },
    {
      name: 'ur_PK-fasih',
      path: 'D:\\own-ai\\models\\piper\\ur_PK-fasih\\ur_PK-fasih.onnx.json',
      kind: 'piper',
      size: 0
    }
  ],
  wakeword: [
    {
      name: 'hey_jarvis_en_base_final.onnx',
      path: 'D:\\own-ai\\models\\wakeword\\hey_jarvis_en_base_final.onnx',
      kind: 'wakeword',
      size: 0
    }
  ],
  characters: [],
  animations: [],
  reference: [
    {
      name: 'img1_nishimiya.png',
      path: 'D:\\own-ai\\reference\\img1_nishimiya.png',
      kind: 'reference',
      size: 0
    },
    { name: 'img2_shoya.png', path: 'D:\\own-ai\\reference\\img2_shoya.png', kind: 'reference', size: 0 },
    {
      name: 'img3_nishimiya_full.png',
      path: 'D:\\own-ai\\reference\\img3_nishimiya_full.png',
      kind: 'reference',
      size: 0
    },
    {
      name: 'img4_shoya_full.png',
      path: 'D:\\own-ai\\reference\\img4_shoya_full.png',
      kind: 'reference',
      size: 0
    }
  ],
  projects: [
    { name: 'luna-ai', path: 'D:\\own-ai\\projects\\luna-ai', kind: 'project', size: 0 },
    { name: 'portfolio-site', path: 'D:\\own-ai\\projects\\portfolio-site', kind: 'project', size: 0 },
    { name: 'iot-dashboard', path: 'D:\\own-ai\\projects\\iot-dashboard', kind: 'project', size: 0 }
  ],
  warnings: []
}

const SAMPLE_TURNS = [
  {
    role: 'user' as const,
    content: 'Can you build me an offline AI companion for Windows?',
    ts: now - 20 * 60000
  },
  {
    role: 'assistant' as const,
    content:
      'Yes! That is exactly what I am. I run fully offline using your local models, with a 3D character, voice, memory and tools — all described in LUNA_spec.md. Where should we start?',
    ts: now - 19 * 60000
  },
  {
    role: 'user' as const,
    content: 'Set up the Ollama model library under the workspace.',
    ts: now - 18 * 60000
  },
  {
    role: 'assistant' as const,
    content:
      'Done. Your Ollama library is at D:\\own-ai\\models\\ollama\\ with qwen2.5:7b, qwen2.5:3b, qwen2.5vl:3b and nomic-embed-text. I will pick qwen2.5:7b for chat automatically.',
    ts: now - 17 * 60000
  },
  { role: 'user' as const, content: 'What is the roadmap?', ts: now - 5 * 60000 },
  {
    role: 'assistant' as const,
    content:
      'Five milestones: M1 walking skeleton, M2 talking character, M3 useful assistant, M4 Shoya & advanced, M5 ship it. We just shipped the M1 build (v0.2.0).',
    ts: now - 4 * 60000
  }
]

const SAMPLE_SESSIONS: LunaSession[] = [
  {
    id: 's1',
    name: 'Chat 2026-08-14 10:12',
    saved: true,
    createdAt: now - 2 * 3600 * MS,
    updatedAt: now - 4 * 60000,
    turns: SAMPLE_TURNS
  },
  {
    id: 's2',
    name: 'Chat 2026-08-13 18:40',
    saved: false,
    createdAt: now - 1 * 86400 * MS,
    updatedAt: now - 20 * 3600 * MS,
    turns: [
      { role: 'user' as const, content: 'Explain the offline-first routing.', ts: now - 20 * 3600 * MS },
      {
        role: 'assistant' as const,
        content:
          'Each task is routed to the best local provider: chat → qwen2.5:7b, vision → qwen2.5vl:3b, embeddings → nomic-embed-text, and it falls back gracefully when offline.',
        ts: now - 19 * 3600 * MS
      }
    ]
  },
  {
    id: 's3',
    name: 'Chat 2026-08-12 09:05',
    saved: true,
    createdAt: now - 2 * 86400 * MS,
    updatedAt: now - 2 * 86400 * MS + 15 * 60000,
    turns: [
      {
        role: 'user' as const,
        content: 'Remember my color palette: violet and cyan.',
        ts: now - 2 * 86400 * MS
      },
      {
        role: 'assistant' as const,
        content:
          'Saved to long-term memory. I will use violet (#B24BF3) for LUNA and cyan (#3AD1FF) for Shoya in future conversations.',
        ts: now - 2 * 86400 * MS + 15 * 60000
      }
    ]
  }
]

const SAMPLE_MEMORY: MemoryEntry[] = [
  {
    id: 'm1',
    tier: 'long',
    text: 'My accent colors: LUNA violet #B24BF3, Shoya cyan #3AD1FF.',
    tags: ['design'],
    saved: true,
    createdAt: now - 2 * 86400 * MS
  },
  {
    id: 'm2',
    tier: 'project',
    text: 'luna-ai uses Electron + Babylon.js, electron-vite, TypeScript. Release via GitHub Actions.',
    project: 'luna-ai',
    tags: ['stack'],
    saved: true,
    createdAt: now - 1 * 86400 * MS
  },
  {
    id: 'm3',
    tier: 'long',
    text: 'I prefer concise answers and no unnecessary apologies.',
    tags: ['preference'],
    saved: false,
    createdAt: now - 12 * 3600 * MS
  },
  {
    id: 'm4',
    tier: 'session',
    text: 'Started building the memory UI for sessions.',
    tags: ['todo'],
    saved: false,
    createdAt: now - 6 * 3600 * MS,
    expiresAt: now + 6 * 86400 * MS
  },
  {
    id: 'm5',
    tier: 'project',
    text: 'portfolio-site uses a glassy dark theme, Dribbble-style.',
    project: 'portfolio-site',
    tags: ['design'],
    saved: false,
    createdAt: now - 3 * 3600 * MS
  }
]

let currentSessionId = SAMPLE_SESSIONS[0].id
let memEntries = [...SAMPLE_MEMORY]
let sessionList = [...SAMPLE_SESSIONS]
let tokenListeners: Array<(chunk: string) => void> = []
let stateListeners: Array<(s: AppState) => void> = []

function pushTokens(text: string): void {
  const step = Math.max(2, Math.floor(text.length / 40))
  for (let i = 0; i < text.length; i += step) {
    const chunk = text.slice(i, i + step)
    setTimeout(() => tokenListeners.forEach((cb) => cb(chunk)), 30 + (i / step) * 18)
  }
}

function svgImage(label: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#2a1b4d"/><stop offset="1" stop-color="#14141f"/>` +
    `</linearGradient></defs>` +
    `<rect width="240" height="320" fill="url(#g)"/>` +
    `<rect x="1" y="1" width="238" height="318" fill="none" stroke="#3d3d55" stroke-width="2"/>` +
    `<circle cx="120" cy="120" r="48" fill="none" stroke="#b24bf3" stroke-width="2"/>` +
    `<text x="120" y="212" fill="#9a9ab0" font-family="Segoe UI" font-size="12" text-anchor="middle">${label}</text>` +
    `<text x="120" y="240" fill="#5c5c78" font-family="Segoe UI" font-size="10" text-anchor="middle">concept art (preview)</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const mockBridge: LunaBridge = {
  config: {
    get: () => Promise.resolve({ ...SAMPLE_CONFIG }),
    set: () => Promise.resolve()
  },
  scan: () => Promise.resolve(SAMPLE_SCAN),
  assets: {
    image: (path) => Promise.resolve(svgImage(path.split(/[\\/]/).pop() ?? 'concept art')),
    binary: () => Promise.resolve(null)
  },
  ollama: {
    health: () => Promise.resolve({ ok: true, url: SAMPLE_CONFIG.ollamaUrl }),
    models: () => Promise.resolve(SAMPLE_MODELS)
  },
  float: {
    toggle: () => Promise.resolve(true),
    open: () => Promise.resolve(true),
    close: () => Promise.resolve(true),
    setAlwaysOnTop: () => Promise.resolve(true)
  },
  sendChat: (text) =>
    new Promise<string>((resolve) => {
      const reply =
        'That is a great question! In this design preview I run on a mock brain, but in the real app I use your local Ollama models — fully offline.\n\n' +
        `You asked: “${text}”. Since this is just the visual demo, here is a sample answer so you can see the chat bubbles, streaming effect and layout in action.`
      pushTokens(reply)
      setTimeout(() => resolve(reply), 40 + (reply.length / 2) * 18)
    }),
  onChatToken: (cb) => {
    tokenListeners.push(cb)
  },
  onState: (cb) => {
    stateListeners.push(cb)
    setTimeout(() => cb(SAMPLE_STATE), 50)
  },
  sessions: {
    list: () => Promise.resolve(sessionList),
    current: () => Promise.resolve(sessionList.find((s) => s.id === currentSessionId) ?? sessionList[0]),
    create: () => {
      const s: LunaSession = {
        id: `s${Date.now()}`,
        name: `Chat ${new Date().toLocaleString()}`,
        saved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        turns: []
      }
      sessionList = [s, ...sessionList]
      currentSessionId = s.id
      return Promise.resolve(s)
    },
    save: (id) => {
      const s = sessionList.find((x) => x.id === id)
      if (s) s.saved = true
      return Promise.resolve(!!s)
    },
    unsave: (id) => {
      const s = sessionList.find((x) => x.id === id)
      if (s) s.saved = false
      return Promise.resolve(!!s)
    },
    remove: (id) => {
      const before = sessionList.length
      sessionList = sessionList.filter((x) => x.id !== id)
      if (currentSessionId === id) currentSessionId = ''
      return Promise.resolve(sessionList.length !== before)
    },
    rename: (id, name) => {
      const s = sessionList.find((x) => x.id === id)
      if (s) s.name = name
      return Promise.resolve(!!s)
    },
    prune: () => Promise.resolve(0)
  },
  memory: {
    list: () => Promise.resolve([...memEntries]),
    add: (input) => {
      const e: MemoryEntry = {
        id: `m${Date.now()}`,
        tier: input.tier as MemoryTier,
        text: input.text,
        project: input.project,
        tags: input.tags ?? [],
        saved: input.saved ?? false,
        createdAt: Date.now(),
        expiresAt: input.tier === 'session' && !input.saved ? Date.now() + 7 * 86400 * MS : undefined
      }
      memEntries = [e, ...memEntries]
      return Promise.resolve(e)
    },
    search: (query) => {
      const q = query.toLowerCase()
      return Promise.resolve(memEntries.filter((e) => e.text.toLowerCase().includes(q)))
    },
    delete: (id) => {
      const before = memEntries.length
      memEntries = memEntries.filter((e) => e.id !== id)
      return Promise.resolve(memEntries.length !== before)
    },
    pin: (id, saved) => {
      const e = memEntries.find((x) => x.id === id)
      if (e) {
        e.saved = saved
        e.expiresAt = saved || e.tier !== 'session' ? undefined : Date.now() + 7 * 86400 * MS
      }
      return Promise.resolve(!!e)
    },
    clear: (tier) => {
      const before = memEntries.length
      memEntries = tier ? memEntries.filter((e) => e.tier !== tier) : []
      return Promise.resolve(before - memEntries.length)
    },
    export: () => Promise.resolve(JSON.stringify(memEntries, null, 2)),
    prune: () => Promise.resolve(0)
  }
}
