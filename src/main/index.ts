import { app, globalShortcut, session } from 'electron'
import { loadConfig } from './config'
import { ensureWorkspace } from './scanner'
import { memory, sessions } from './memory'
import { activity } from './activity'
import { ollamaHealth, listOllamaModels } from './ollama'
import { stopSpeaking } from './tts'
import { createTray } from './tray'
import { hideDashboard, openDashboard, toggleFloat } from './ui'
import { setState } from './state'
import { registerPermissionHandler } from './permission'
import { registerCoreHandlers } from './handlers-core'
import { registerAiHandlers } from './handlers-ai'
import { registerVoiceHandlers } from './voice'

async function refreshOllama(): Promise<void> {
  const cfg = loadConfig()
  const ok = await ollamaHealth(cfg.ollamaUrl)
  setState({ luna: ok ? 'online' : 'offline' })
  if (ok) {
    const models = await listOllamaModels(cfg.ollamaUrl)
    setState({ activeModel: models[0]?.name ?? '' })
  }
}

app.whenReady().then(() => {
  const cfg = loadConfig()
  ensureWorkspace(cfg.aiRoot)
  memory.init(cfg.aiRoot)
  sessions.init(cfg.aiRoot)
  activity.init(cfg.aiRoot)
  activity.log('app', 'LUNA started')

  app.setLoginItemSettings({
    openAtLogin: cfg.background.startWithWindows,
    openAsHidden: cfg.background.startMinimized
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem')
  })

  registerPermissionHandler()
  registerCoreHandlers()
  registerAiHandlers()
  registerVoiceHandlers()

  createTray({
    toggleFloat,
    showDashboard: openDashboard,
    quit: () => app.quit()
  })

  const hotkey = cfg.background.hotkey
  if (hotkey) {
    const registered = globalShortcut.register(hotkey, () => {
      activity.log('hotkey', `Push-to-talk hotkey: ${hotkey}`)
      toggleFloat()
    })
    if (registered) activity.log('app', `Push-to-talk hotkey active: ${hotkey}`)
    else activity.log('app', `Hotkey registration failed: ${hotkey}`, 'warn')
  }

  openDashboard()
  void refreshOllama()
  setInterval(refreshOllama, 15000)

  if (cfg.background.startMinimized) hideDashboard()
})

app.on('window-all-closed', () => {
  // Background service: keep running in the tray, no window open (§10).
  activity.log('app', 'All windows closed — staying in tray')
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('before-quit', () => {
  stopSpeaking()
})

app.on('activate', () => {
  openDashboard()
})