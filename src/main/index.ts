import { app, BrowserWindow, ipcMain } from 'electron'
import { loadConfig, saveConfig } from './config'
import { ensureWorkspace, scanWorkspace } from './scanner'
import { ollamaChatStream, ollamaHealth, listOllamaModels } from './ollama'
import type { ChatMessage } from './ollama'
import { memory, sessions } from './memory'
import { safeBinary, safeImageDataUrl } from './assets'
import { createDashboardWindow, createFloatWindow } from './windows'
import { createTray } from './tray'
import type { AppState, LunaSession, MemoryEntry, MemoryTier } from '../shared/types'

let dashboard: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let currentSessionId = ''

const state: AppState = {
  char: 'idle',
  status: 'Ready to assist...',
  subtitle: '',
  luna: 'unknown',
  shoya: 'unknown',
  activeModel: ''
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('luna:state', state)
  }
}

function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch)
  broadcast()
}

async function refreshOllama(): Promise<void> {
  const cfg = loadConfig()
  const ok = await ollamaHealth(cfg.ollamaUrl)
  setState({ luna: ok ? 'online' : 'offline' })
  if (ok) {
    const models = await listOllamaModels(cfg.ollamaUrl)
    setState({ activeModel: models[0]?.name ?? '' })
  }
}

function openDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show()
    dashboard.focus()
    return
  }
  dashboard = createDashboardWindow()
  dashboard.on('closed', () => {
    dashboard = null
  })
}

function toggleFloat(): void {
  if (floatWindow && !floatWindow.isDestroyed()) {
    if (floatWindow.isVisible()) floatWindow.hide()
    else {
      floatWindow.show()
      floatWindow.focus()
    }
    return
  }
  floatWindow = createFloatWindow()
  floatWindow.on('closed', () => {
    floatWindow = null
  })
}

function closeFloat(): void {
  if (floatWindow && !floatWindow.isDestroyed()) floatWindow.close()
}

app.whenReady().then(() => {
  const cfg = loadConfig()
  ensureWorkspace(cfg.aiRoot)
  memory.init(cfg.aiRoot)
  sessions.init(cfg.aiRoot)
  createTray({
    toggleFloat,
    showDashboard: openDashboard,
    quit: () => app.quit()
  })

  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_e, c: Parameters<typeof saveConfig>[0]) => {
    saveConfig(c)
  })
  ipcMain.handle('scan', () => scanWorkspace(loadConfig().aiRoot))
  ipcMain.handle('assets:image', (_e, p: string) => safeImageDataUrl(loadConfig().aiRoot, p))
  ipcMain.handle('assets:binary', (_e, p: string) => safeBinary(loadConfig().aiRoot, p))
  ipcMain.handle('ollama:health', async () => {
    const c = loadConfig()
    const ok = await ollamaHealth(c.ollamaUrl)
    setState({ luna: ok ? 'online' : 'offline' })
    return { ok, url: c.ollamaUrl }
  })
  ipcMain.handle('ollama:models', async () => listOllamaModels(loadConfig().ollamaUrl))
  ipcMain.handle('chat', async (event, text: string) => {
    const c = loadConfig()
    setState({ char: 'thinking', status: 'Thinking...' })
    try {
      const ok = await ollamaHealth(c.ollamaUrl)
      if (!ok) {
        setState({ char: 'idle', status: 'Offline — start Ollama to chat locally' })
        return 'LUNA is offline and Ollama is not running. Start Ollama (with OLLAMA_MODELS=D:\\own-ai\\models\\ollama) to chat locally.'
      }
      const models = await listOllamaModels(c.ollamaUrl)
      const preferred =
        models.find((m) => m.name === c.character.luna.model) ??
        models.find((m) => m.name.startsWith('qwen2.5:7b')) ??
        models.find((m) => m.name.startsWith('qwen2.5'))
      const model = preferred?.name ?? models[0]?.name
      if (!model) {
        setState({ char: 'idle', status: 'No local models found' })
        return 'No local models found. Run `ollama pull qwen2.5` to add one.'
      }
      const session = currentSessionId ? sessions.get(currentSessionId) : undefined
      const recall = memory.recall(text)
      const system =
        'You are LUNA, a warm, gentle, intelligent, patient AI companion. You are helpful, honest about your limits, and never pretend a failed action succeeded. Reply concisely.' +
        (recall ? `\n\nRelevant memories from earlier conversations:\n${recall}` : '')
      const history: ChatMessage[] = [
        { role: 'system', content: system },
        ...(session ? sessions.history(currentSessionId) : []),
        { role: 'user', content: text }
      ]
      if (session) sessions.appendTurn(currentSessionId, 'user', text)
      setState({ char: 'thinking', status: 'Thinking...', activeModel: model })
      const reply = await ollamaChatStream(c.ollamaUrl, model, history, (chunk) => {
        if (!event.sender.isDestroyed()) event.sender.send('chat:token', chunk)
      })
      if (session) sessions.appendTurn(currentSessionId, 'assistant', reply)
      setState({ char: 'idle', status: 'Ready to assist...', activeModel: model })
      return reply
    } catch (err) {
      setState({ char: 'idle', status: 'Chat error' })
      return `Error: ${(err as Error).message}`
    }
  })
  ipcMain.handle('sessions:list', (): LunaSession[] => sessions.list())
  ipcMain.handle('sessions:current', (): LunaSession => {
    if (!currentSessionId || !sessions.get(currentSessionId)) {
      currentSessionId = sessions.create().id
    }
    return sessions.get(currentSessionId) as LunaSession
  })
  ipcMain.handle('sessions:new', (_e, name?: string): LunaSession => {
    currentSessionId = sessions.create(name).id
    return sessions.get(currentSessionId) as LunaSession
  })
  ipcMain.handle('sessions:save', (_e, id: string): boolean => sessions.save(id))
  ipcMain.handle('sessions:unsave', (_e, id: string): boolean => sessions.unsave(id))
  ipcMain.handle('sessions:remove', (_e, id: string): boolean => {
    const ok = sessions.remove(id)
    if (ok && id === currentSessionId) currentSessionId = ''
    return ok
  })
  ipcMain.handle('sessions:rename', (_e, id: string, name: string): boolean => sessions.rename(id, name))
  ipcMain.handle('sessions:prune', (): number => sessions.pruneExpired())
  ipcMain.handle('memory:list', (): MemoryEntry[] => memory.list())
  ipcMain.handle(
    'memory:add',
    (
      _e,
      input: { tier: MemoryTier; text: string; project?: string; tags?: string[]; saved?: boolean }
    ): MemoryEntry => memory.add(input)
  )
  ipcMain.handle('memory:search', (_e, query: string): MemoryEntry[] => memory.search(query))
  ipcMain.handle('memory:delete', (_e, id: string): boolean => memory.delete(id))
  ipcMain.handle('memory:pin', (_e, id: string, saved: boolean): boolean => memory.pin(id, saved))
  ipcMain.handle('memory:clear', (_e, tier?: MemoryTier): number => memory.clear(tier))
  ipcMain.handle('memory:export', (): string => memory.export())
  ipcMain.handle('memory:prune', (): number => memory.pruneExpired())
  ipcMain.handle('float:toggle', () => {
    toggleFloat()
    return true
  })
  ipcMain.handle('float:alwaysOnTop', (_e, flag: boolean) => {
    if (floatWindow && !floatWindow.isDestroyed()) floatWindow.setAlwaysOnTop(flag)
    return true
  })
  ipcMain.handle('float:close', () => {
    closeFloat()
    return true
  })
  ipcMain.handle('float:open', () => {
    if (!floatWindow || floatWindow.isDestroyed()) toggleFloat()
    else if (!floatWindow.isVisible()) floatWindow.show()
    return true
  })

  openDashboard()
  void refreshOllama()
  setInterval(refreshOllama, 15000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  openDashboard()
})
