import { app, BrowserWindow, ipcMain } from 'electron'
import { loadConfig, saveConfig } from './config'
import { ensureWorkspace, scanWorkspace } from './scanner'
import { ollamaChat, ollamaHealth, listOllamaModels } from './ollama'
import type { ChatMessage } from './ollama'
import { createDashboardWindow, createFloatWindow } from './windows'
import { createTray } from './tray'
import type { AppState } from '../shared/types'

let dashboard: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null

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
  ipcMain.handle('ollama:health', async () => {
    const c = loadConfig()
    const ok = await ollamaHealth(c.ollamaUrl)
    setState({ luna: ok ? 'online' : 'offline' })
    return { ok, url: c.ollamaUrl }
  })
  ipcMain.handle('ollama:models', async () => listOllamaModels(loadConfig().ollamaUrl))
  ipcMain.handle('chat', async (_e, text: string) => {
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
        models.find((m) => m.name.startsWith('qwen2.5:7b')) ??
        models.find((m) => m.name.startsWith('qwen2.5'))
      const model = preferred?.name ?? models[0]?.name
      if (!model) {
        setState({ char: 'idle', status: 'No local models found' })
        return 'No local models found. Run `ollama pull qwen2.5` to add one.'
      }
      const history: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are LUNA, a warm, gentle, intelligent, patient AI companion. You are helpful, honest about your limits, and never pretend a failed action succeeded. Reply concisely.'
        },
        { role: 'user', content: text }
      ]
      const reply = await ollamaChat(c.ollamaUrl, model, history)
      setState({ char: 'idle', status: 'Ready to assist...', activeModel: model })
      return reply
    } catch (err) {
      setState({ char: 'idle', status: 'Chat error' })
      return `Error: ${(err as Error).message}`
    }
  })
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
