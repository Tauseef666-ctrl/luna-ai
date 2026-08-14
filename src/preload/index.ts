import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppState,
  LunaConfig,
  LunaSession,
  MemoryEntry,
  MemoryTier,
  OllamaModel,
  ScanResult
} from '../shared/types'

export interface LunaBridge {
  config: {
    get(): Promise<LunaConfig>
    set(cfg: LunaConfig): Promise<void>
  }
  scan(): Promise<ScanResult>
  assets: {
    image(path: string): Promise<string>
    binary(path: string): Promise<Uint8Array | null>
  }
  ollama: {
    health(): Promise<{ ok: boolean; url: string }>
    models(): Promise<OllamaModel[]>
  }
  float: {
    toggle(): Promise<boolean>
    open(): Promise<boolean>
    close(): Promise<boolean>
    setAlwaysOnTop(flag: boolean): Promise<boolean>
  }
  sendChat(text: string): Promise<string>
  onChatToken(cb: (chunk: string) => void): void
  onState(cb: (s: AppState) => void): void
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
}

const bridge: LunaBridge = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg) => ipcRenderer.invoke('config:set', cfg)
  },
  scan: () => ipcRenderer.invoke('scan'),
  assets: {
    image: (path) => ipcRenderer.invoke('assets:image', path),
    binary: (path) => ipcRenderer.invoke('assets:binary', path)
  },
  ollama: {
    health: () => ipcRenderer.invoke('ollama:health'),
    models: () => ipcRenderer.invoke('ollama:models')
  },
  float: {
    toggle: () => ipcRenderer.invoke('float:toggle'),
    open: () => ipcRenderer.invoke('float:open'),
    close: () => ipcRenderer.invoke('float:close'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('float:alwaysOnTop', flag)
  },
  sendChat: (text) => ipcRenderer.invoke('chat', text),
  onChatToken: (cb) => {
    ipcRenderer.on('chat:token', (_e: IpcRendererEvent, chunk: string) => cb(chunk))
  },
  onState: (cb) => {
    ipcRenderer.on('luna:state', (_e: IpcRendererEvent, s: AppState) => cb(s))
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
  }
}

contextBridge.exposeInMainWorld('luna', bridge)
