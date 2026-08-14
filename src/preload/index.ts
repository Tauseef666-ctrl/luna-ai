import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AppState, LunaConfig, OllamaModel, ScanResult } from '../shared/types'

export interface LunaBridge {
  config: {
    get(): Promise<LunaConfig>
    set(cfg: LunaConfig): Promise<void>
  }
  scan(): Promise<ScanResult>
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
  onState(cb: (s: AppState) => void): void
}

const bridge: LunaBridge = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg) => ipcRenderer.invoke('config:set', cfg)
  },
  scan: () => ipcRenderer.invoke('scan'),
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
  onState: (cb) => {
    ipcRenderer.on('luna:state', (_e: IpcRendererEvent, s: AppState) => cb(s))
  }
}

contextBridge.exposeInMainWorld('luna', bridge)
