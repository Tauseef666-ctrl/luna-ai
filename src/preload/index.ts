import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  ActivityEvent,
  AiSwitchPayload,
  AppState,
  BrowserState,
  CalendarEvent,
  CharacterStatePayload,
  CharId,
  CharState,
  CodingContext,
  DigestPayload,
  LipsyncPayload,
  LunaConfig,
  LunaSession,
  MemoryEntry,
  MemoryTier,
  OllamaModel,
  PermissionRequest,
  PermissionResolved,
  PointPayload,
  ProjectInfo,
  ProviderStatus,
  ResearchResult,
  NewsResult,
  RouteResult,
  Routine,
  RoutinePayload,
  ScanResult,
  ShoyaDetection,
  ShoyaRunResult,
  SkillInfo,
  SkillRunResult,
  SubtitlePayload,
  TtsAudioPayload,
  TtsStatus,
  VscodeStatus
} from '../shared/types'

export interface LunaBridge {
  config: {
    get(): Promise<LunaConfig>
    set(cfg: LunaConfig): Promise<void>
  }
  scan(): Promise<ScanResult>
  projects: {
    list(): Promise<ProjectInfo[]>
    create(name: string): Promise<ProjectInfo | null>
    rename(oldName: string, newName: string): Promise<boolean>
    delete(name: string): Promise<boolean>
  }
  activity: {
    list(limit?: number): Promise<ActivityEvent[]>
    clear(): Promise<number>
  }
  assets: {
    image(path: string): Promise<string>
    binary(path: string): Promise<Uint8Array | null>
  }
  ollama: {
    health(): Promise<{ ok: boolean; url: string }>
    models(): Promise<OllamaModel[]>
  }
  providers: {
    test(id: string): Promise<{ ok: boolean; latencyMs: number; detail: string; models: string[] }>
    status(): Promise<ProviderStatus[]>
    chat(id: string, text: string): Promise<string>
  }
  secret: {
    set(ref: string, value: string): Promise<boolean>
    has(ref: string): Promise<boolean>
    delete(ref: string): Promise<boolean>
  }
  shoya: {
    detect(): Promise<ShoyaDetection>
    run(prompt: string, projectDir?: string): Promise<ShoyaRunResult>
    launch(projectDir?: string): Promise<boolean>
  }
  router: {
    route(text: string): Promise<RouteResult>
  }
  skills: {
    list(): Promise<SkillInfo[]>
    toggle(id: string, enabled: boolean): Promise<boolean>
    run(id: string, query?: string): Promise<SkillRunResult>
  }
  routines: {
    list(): Promise<Routine[]>
    add(input: {
      kind: Routine['kind']
      text: string
      schedule: Routine['schedule']
    }): Promise<Routine>
    remove(id: string): Promise<boolean>
    toggle(id: string, enabled: boolean): Promise<Routine | null>
  }
  onProactiveRoutine(cb: (p: RoutinePayload) => void): void
  calendar: {
    list(from?: number, to?: number): Promise<CalendarEvent[]>
    upcoming(limit?: number): Promise<CalendarEvent[]>
    add(input: {
      title: string
      start: number
      end?: number
      notes?: string
    }): Promise<CalendarEvent | null>
    update(id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>): Promise<CalendarEvent | null>
    remove(id: string): Promise<boolean>
    parseWhen(text: string): Promise<number | null>
  }
  clipboard: {
    enabled(): Promise<boolean>
    read(): Promise<string>
    write(text: string): Promise<{ ok: boolean; reason?: string }>
  }
  browser: {
    state(): Promise<BrowserState>
    open(url: string): Promise<{ ok: boolean; output: string }>
    read(): Promise<{ ok: boolean; output: string }>
    close(): Promise<{ ok: boolean; output: string }>
  }
  onBrowserState(cb: (p: BrowserState) => void): void
  context: {
    gather(projectDir?: string): Promise<CodingContext>
    block(projectDir?: string): Promise<string>
  }
  vscode: {
    status(): Promise<VscodeStatus>
    open(path: string): Promise<boolean>
    openFile(file: string): Promise<boolean>
    openTerminal(dir: string): Promise<boolean>
  }
  research: {
    run(query: string): Promise<ResearchResult>
    news(topics?: string[]): Promise<NewsResult>
  }
  sendChat(text: string): Promise<string>
  onChatToken(cb: (chunk: string) => void): void
  onState(cb: (s: AppState) => void): void
  tts: {
    status(): Promise<TtsStatus>
    speak(text: string, voice?: string): Promise<void>
    stop(): Promise<boolean>
    done(): Promise<boolean>
    level(v: number): void
    onStarted(cb: () => void): void
    onAudio(cb: (a: TtsAudioPayload) => void): void
    onEnded(cb: () => void): void
    onError(cb: (msg: string) => void): void
    onLevel(cb: (v: number) => void): void
  }
  sessions: {
    list(): Promise<LunaSession[]>
    current(): Promise<LunaSession>
    create(name?: string): Promise<LunaSession>
    save(id: string): Promise<boolean>
    unsave(id: string): Promise<boolean>
    remove(id: string): Promise<boolean>
    rename(id: string, name: string): Promise<boolean>
    prune(): Promise<number>
  }
  memory: {
    list(): Promise<MemoryEntry[]>
    add(input: {
      tier: MemoryTier
      text: string
      project?: string
      tags?: string[]
      saved?: boolean
    }): Promise<MemoryEntry>
    search(query: string): Promise<MemoryEntry[]>
    delete(id: string): Promise<boolean>
    pin(id: string, saved: boolean): Promise<boolean>
    clear(tier?: MemoryTier): Promise<number>
    export(): Promise<string>
    prune(): Promise<number>
  }
  // ---------- shared contract (AGENTS.md) ----------
  onCharacterState(cb: (p: CharacterStatePayload) => void): void
  onLipsync(cb: (p: LipsyncPayload) => void): void
  onPoint(cb: (p: PointPayload) => void): void
  onSubtitle(cb: (p: SubtitlePayload) => void): void
  onAiSwitched(cb: (p: AiSwitchPayload) => void): void
  onPermissionRequest(cb: (p: PermissionRequest) => void): void
  onPermissionResolved(cb: (p: PermissionResolved) => void): void
  onDigest(cb: (p: DigestPayload) => void): void
  voice: {
    input(text: string, language: string): void
    audio(wavBase64: string, sampleRate: number, language: string): void
  }
  voiceId: {
    status(): Promise<{ enabled: boolean; guest: boolean; enrolled: boolean }>
    enroll(wavBase64: string): Promise<{ ok: boolean; reason: string; frames?: number }>
    verify(wavBase64: string): Promise<{ enrolled: boolean; match: boolean; score: number }>
    clear(): Promise<boolean>
  }
  hotkey: {
    pressed(key: string): void
  }
  permission: {
    respond(req: PermissionRequest, approved: boolean): void
  }
  ai: {
    switch(active: CharId): void
  }
  onVoiceHeard(cb: (p: { text: string; language: string }) => void): void
  setCharacterState(character: CharId, state: CharState): void
  onPushToTalk(cb: () => void): void
}

const bridge: LunaBridge = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg) => ipcRenderer.invoke('config:set', cfg)
  },
  scan: () => ipcRenderer.invoke('scan'),
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name) => ipcRenderer.invoke('projects:create', name),
    rename: (oldName, newName) => ipcRenderer.invoke('projects:rename', oldName, newName),
    delete: (name) => ipcRenderer.invoke('projects:delete', name)
  },
  activity: {
    list: (limit) => ipcRenderer.invoke('activity:list', limit),
    clear: () => ipcRenderer.invoke('activity:clear')
  },
  assets: {
    image: (path) => ipcRenderer.invoke('assets:image', path),
    binary: (path) => ipcRenderer.invoke('assets:binary', path)
  },
  ollama: {
    health: () => ipcRenderer.invoke('ollama:health'),
    models: () => ipcRenderer.invoke('ollama:models')
  },
  providers: {
    test: (id) => ipcRenderer.invoke('providers:test', id),
    status: () => ipcRenderer.invoke('providers:status'),
    chat: (id, text) => ipcRenderer.invoke('providers:chat', id, text)
  },
  secret: {
    set: (ref, value) => ipcRenderer.invoke('secret:set', ref, value),
    has: (ref) => ipcRenderer.invoke('secret:has', ref),
    delete: (ref) => ipcRenderer.invoke('secret:delete', ref)
  },
  shoya: {
    detect: () => ipcRenderer.invoke('shoya:detect'),
    run: (prompt, projectDir) => ipcRenderer.invoke('shoya:run', prompt, projectDir),
    launch: (projectDir) => ipcRenderer.invoke('shoya:launch', projectDir)
  },
  router: {
    route: (text) => ipcRenderer.invoke('router:route', text)
  },
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    toggle: (id, enabled) => ipcRenderer.invoke('skills:toggle', id, enabled),
    run: (id, query) => ipcRenderer.invoke('skills:run', id, query)
  },
  context: {
    gather: (projectDir) => ipcRenderer.invoke('context:gather', projectDir),
    block: (projectDir) => ipcRenderer.invoke('context:block', projectDir)
  },
  vscode: {
    status: () => ipcRenderer.invoke('vscode:status'),
    open: (path) => ipcRenderer.invoke('vscode:open', path),
    openFile: (file) => ipcRenderer.invoke('vscode:openFile', file),
    openTerminal: (dir) => ipcRenderer.invoke('vscode:openTerminal', dir)
  },
  research: {
    run: (query) => ipcRenderer.invoke('research:run', query),
    news: (topics) => ipcRenderer.invoke('research:news', topics)
  },
  sendChat: (text) => ipcRenderer.invoke('chat', text),
  onChatToken: (cb) => {
    ipcRenderer.on('chat:token', (_e: IpcRendererEvent, chunk: string) => cb(chunk))
  },
  onState: (cb) => {
    ipcRenderer.on('luna:state', (_e: IpcRendererEvent, s: AppState) => cb(s))
  },
  tts: {
    status: () => ipcRenderer.invoke('tts:status'),
    speak: (text, voice) => ipcRenderer.invoke('tts:speak', text, voice),
    stop: () => ipcRenderer.invoke('tts:stop'),
    done: () => ipcRenderer.invoke('tts:done'),
    level: (v) => ipcRenderer.send('tts:level', v),
    onStarted: (cb) => {
      ipcRenderer.on('tts:started', () => cb())
    },
    onAudio: (cb) => {
      ipcRenderer.on('tts:audio', (_e: IpcRendererEvent, a: TtsAudioPayload) => cb(a))
    },
    onEnded: (cb) => {
      ipcRenderer.on('tts:ended', () => cb())
    },
    onError: (cb) => {
      ipcRenderer.on('tts:error', (_e: IpcRendererEvent, msg: string) => cb(msg))
    },
    onLevel: (cb) => {
      ipcRenderer.on('tts:level', (_e: IpcRendererEvent, v: number) => cb(v))
    }
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    current: () => ipcRenderer.invoke('sessions:current'),
    create: (name) => ipcRenderer.invoke('sessions:new', name),
    save: (id) => ipcRenderer.invoke('sessions:save', id),
    unsave: (id) => ipcRenderer.invoke('sessions:unsave', id),
    remove: (id) => ipcRenderer.invoke('sessions:remove', id),
    rename: (id, name) => ipcRenderer.invoke('sessions:rename', id, name),
    prune: () => ipcRenderer.invoke('sessions:prune')
  },
  memory: {
    list: () => ipcRenderer.invoke('memory:list'),
    add: (input) => ipcRenderer.invoke('memory:add', input),
    search: (query) => ipcRenderer.invoke('memory:search', query),
    delete: (id) => ipcRenderer.invoke('memory:delete', id),
    pin: (id, saved) => ipcRenderer.invoke('memory:pin', id, saved),
    clear: (tier) => ipcRenderer.invoke('memory:clear', tier),
    export: () => ipcRenderer.invoke('memory:export'),
    prune: () => ipcRenderer.invoke('memory:prune')
  },
  onCharacterState: (cb) => {
    ipcRenderer.on('character:setState', (_e: IpcRendererEvent, p: CharacterStatePayload) => cb(p))
  },
  onLipsync: (cb) => {
    ipcRenderer.on('character:lipsync', (_e: IpcRendererEvent, p: LipsyncPayload) => cb(p))
  },
  onPoint: (cb) => {
    ipcRenderer.on('character:point', (_e: IpcRendererEvent, p: PointPayload) => cb(p))
  },
  onSubtitle: (cb) => {
    ipcRenderer.on('character:subtitle', (_e: IpcRendererEvent, p: SubtitlePayload) => cb(p))
  },
  onAiSwitched: (cb) => {
    ipcRenderer.on('ai:switched', (_e: IpcRendererEvent, p: AiSwitchPayload) => cb(p))
  },
  onPermissionRequest: (cb) => {
    ipcRenderer.on('permission:request', (_e: IpcRendererEvent, p: PermissionRequest) => cb(p))
  },
  onPermissionResolved: (cb) => {
    ipcRenderer.on('permission:resolved', (_e: IpcRendererEvent, p: PermissionResolved) => cb(p))
  },
  onDigest: (cb) => {
    ipcRenderer.on('notification:digest', (_e: IpcRendererEvent, p: DigestPayload) => cb(p))
  },
  routines: {
    list: () => ipcRenderer.invoke('routines:list'),
    add: (input) => ipcRenderer.invoke('routines:add', input),
    remove: (id) => ipcRenderer.invoke('routines:remove', id),
    toggle: (id, enabled) => ipcRenderer.invoke('routines:toggle', id, enabled)
  },
  onProactiveRoutine: (cb) => {
    ipcRenderer.on('proactive:routine', (_e: IpcRendererEvent, p: RoutinePayload) => cb(p))
  },
  calendar: {
    list: (from, to) => ipcRenderer.invoke('calendar:list', from, to),
    upcoming: (limit) => ipcRenderer.invoke('calendar:upcoming', limit),
    add: (input) => ipcRenderer.invoke('calendar:add', input),
    update: (id, patch) => ipcRenderer.invoke('calendar:update', id, patch),
    remove: (id) => ipcRenderer.invoke('calendar:remove', id),
    parseWhen: (text) => ipcRenderer.invoke('calendar:parseWhen', text)
  },
  clipboard: {
    enabled: () => ipcRenderer.invoke('clipboard:enabled'),
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (text) => ipcRenderer.invoke('clipboard:write', text)
  },
  browser: {
    state: () => ipcRenderer.invoke('browser:state'),
    open: (url) => ipcRenderer.invoke('browser:open', url),
    read: () => ipcRenderer.invoke('browser:read'),
    close: () => ipcRenderer.invoke('browser:close')
  },
  onBrowserState: (cb) => {
    ipcRenderer.on('browser:state', (_e: IpcRendererEvent, p: BrowserState) => cb(p))
  },
  voice: {
    input: (text, language) => ipcRenderer.send('voice:input', { text, language }),
    audio: (wavBase64, sampleRate, language) =>
      ipcRenderer.send('voice:audio', { wavBase64, sampleRate, language })
  },
  voiceId: {
    status: () => ipcRenderer.invoke('voiceId:status'),
    enroll: (wavBase64) => ipcRenderer.invoke('voiceId:enroll', wavBase64),
    verify: (wavBase64) => ipcRenderer.invoke('voiceId:verify', wavBase64),
    clear: () => ipcRenderer.invoke('voiceId:clear')
  },
  hotkey: {
    pressed: (key) => ipcRenderer.send('hotkey:pressed', key)
  },
  permission: {
    respond: (req, approved) => ipcRenderer.send('permission:response', { action: req.action, approved })
  },
  ai: {
    switch: (active) => ipcRenderer.send('ai:switch', { active })
  },
  onVoiceHeard: (cb) => {
    ipcRenderer.on('voice:heard', (_e: IpcRendererEvent, p: { text: string; language: string }) => cb(p))
  },
  setCharacterState: (character, state) => ipcRenderer.send('character:set', { character, state }),
  onPushToTalk: (cb) => {
    ipcRenderer.on('hotkey:ptt', () => cb())
  }
}

contextBridge.exposeInMainWorld('luna', bridge)
