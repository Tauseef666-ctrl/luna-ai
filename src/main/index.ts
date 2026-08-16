import { app, BrowserWindow, globalShortcut, ipcMain, session } from 'electron'
import type { WebContents } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig, saveConfig } from './config'
import { ensureWorkspace, scanWorkspace } from './scanner'
import { ollamaChat, ollamaChatStream, ollamaHealth, listOllamaModels } from './ollama'
import type { ChatMessage } from './ollama'
import { memory, sessions } from './memory'
import { activity } from './activity'
import { createProject, deleteProject, listProjects, renameProject } from './projects'
import { safeBinary, safeImageDataUrl } from './assets'
import { findPiperExe, pcmToWav, stopSpeaking, synthesize, voiceSampleRate } from './tts'
import { createDashboardWindow, createFloatWindow } from './windows'
import { createTray } from './tray'
import { detectOpenCode, launchShoyaTerminal, runShoya } from './shoya'
import { route as routeTask } from './router'
import { gatherCodingContext, contextBlock } from './coding-context'
import {
  openFileInVSCode,
  openInVSCode as openInVSCodeImpl,
  openTerminalInVSCode,
  vscodeStatus
} from './vscode'
import { news as researchNews, research as doResearch } from './research'
import { transcribeWav, whisperAvailable } from './stt'
import {
  deleteSecret,
  enabledProviders,
  getSecret,
  providerChat,
  providerStatuses,
  setSecret,
  testConnection
} from './providers'
import type { ProviderConfig, ShoyaRunResult } from '../shared/types'
import type {
  ActivityEvent,
  AppState,
  LunaSession,
  MemoryEntry,
  MemoryTier,
  ProjectInfo,
  TtsAudioPayload,
  TtsStatus
} from '../shared/types'

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

function speakTo(target: WebContents | null, text: string, voice: string): void {
  const c = loadConfig()
  if (!c.tts.enabled || !text || !voice) return
  if (!findPiperExe(c.aiRoot)) return
  stopSpeaking()
  setState({ char: 'speaking', status: 'Speaking...' })
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('tts:started')
  }
  synthesize(c.aiRoot, voice, text, { lengthScale: c.tts.lengthScale })
    .then(({ pcm, sampleRate }) => {
      const wavBase64 = pcmToWav(pcm, sampleRate).toString('base64')
      if (target && !target.isDestroyed()) {
        target.send('tts:audio', { wavBase64, sampleRate } as TtsAudioPayload)
      } else {
        setState({ char: 'idle', status: 'Ready to assist...' })
      }
    })
    .catch((err) => {
      activity.log('tts', `TTS error: ${(err as Error).message}`, 'error')
      setState({ char: 'idle', status: 'Ready to assist...' })
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('tts:ended')
      }
    })
}

function stopTts(): void {
  stopSpeaking()
  setState({ char: 'idle', status: 'Ready to assist...' })
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('tts:ended')
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

  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_e, c: Parameters<typeof saveConfig>[0]) => {
    saveConfig(c)
    activity.log('config', 'Settings updated')
  })
  ipcMain.handle('scan', () => {
    activity.log('scan', 'Workspace re-scanned')
    return scanWorkspace(loadConfig().aiRoot)
  })
  ipcMain.handle('assets:image', (_e, p: string) => safeImageDataUrl(loadConfig().aiRoot, p))
  ipcMain.handle('assets:binary', (_e, p: string) => safeBinary(loadConfig().aiRoot, p))
  ipcMain.handle('projects:list', (): ProjectInfo[] => listProjects(loadConfig().aiRoot))
  ipcMain.handle('projects:create', (_e, name: string): ProjectInfo | null => {
    const p = createProject(loadConfig().aiRoot, name)
    activity.log(
      'projects',
      p ? `Project created: ${p.name}` : `Failed to create project "${name}"`,
      p ? 'success' : 'error'
    )
    return p
  })
  ipcMain.handle('projects:rename', (_e, oldName: string, newName: string): boolean => {
    const ok = renameProject(loadConfig().aiRoot, oldName, newName)
    activity.log(
      'projects',
      ok ? `Project renamed: ${oldName} → ${newName}` : `Failed to rename project "${oldName}"`,
      ok ? 'success' : 'error'
    )
    return ok
  })
  ipcMain.handle('projects:delete', (_e, name: string): boolean => {
    const ok = deleteProject(loadConfig().aiRoot, name)
    activity.log(
      'projects',
      ok ? `Project deleted: ${name}` : `Failed to delete project "${name}"`,
      ok ? 'success' : 'error'
    )
    return ok
  })
  ipcMain.handle('activity:list', (_e, limit?: number): ActivityEvent[] => activity.list(limit))
  ipcMain.handle('activity:clear', (): number => {
    const n = activity.clear()
    activity.log('activity', `Activity log cleared (${n} events)`)
    return n
  })
  ipcMain.handle('ollama:health', async () => {
    const c = loadConfig()
    const ok = await ollamaHealth(c.ollamaUrl)
    setState({ luna: ok ? 'online' : 'offline' })
    return { ok, url: c.ollamaUrl }
  })
  ipcMain.handle('ollama:models', async () => listOllamaModels(loadConfig().ollamaUrl))
  ipcMain.handle('providers:test', (_e, id: string) => {
    const cfg = loadConfig()
    const p = cfg.providers[id] as ProviderConfig | undefined
    if (!p) return { ok: false, latencyMs: 0, detail: `Provider "${id}" not found`, models: [] }
    return testConnection(p)
  })
  ipcMain.handle('providers:status', () => providerStatuses())
  ipcMain.handle('providers:chat', (_e, id: string, text: string) => {
    const cfg = loadConfig()
    const p = cfg.providers[id] as ProviderConfig | undefined
    if (!p) throw new Error(`Provider "${id}" not found`)
    const c = loadConfig()
    const history = [{ role: 'user' as const, content: `${c.chat.systemPrompt}\n\n${text}` }]
    return providerChat(p, history, { temperature: c.chat.temperature, maxTokens: c.chat.maxTokens })
  })
  ipcMain.handle('secret:set', (_e, ref: string, value: string) => {
    const ok = setSecret(ref, value)
    activity.log('security', ok ? `Credential saved: ${ref}` : `Failed to save credential: ${ref}`, ok ? 'success' : 'error')
    return ok
  })
  ipcMain.handle('secret:has', (_e, ref: string): boolean => {
    if (!ref) return false
    return getSecret(ref) !== null
  })
  ipcMain.handle('secret:delete', (_e, ref: string) => {
    const ok = deleteSecret(ref)
    activity.log('security', ok ? `Credential removed: ${ref}` : `Failed to remove credential: ${ref}`, ok ? 'success' : 'error')
    return ok
  })
  ipcMain.handle('shoya:detect', () => {
    return detectOpenCode()
  })
  ipcMain.handle('shoya:run', async (_e, prompt: string, projectDir?: string): Promise<ShoyaRunResult> => {
    if (!prompt || !prompt.trim()) return { ok: false, backend: 'opencode', providerId: '', output: 'Empty prompt', durationMs: 0, truncated: false }
    setState({ char: 'coding', status: 'Shoya is working...' })
    activity.log('shoya', `Shoya run: ${prompt.slice(0, 120)}`)
    try {
      const result = await runShoya(prompt, { projectDir })
      setState({ char: result.ok ? 'success' : 'error', status: result.ok ? 'Shoya finished' : 'Shoya failed' })
      activity.log(
        'shoya',
        `Shoya ${result.ok ? 'completed' : 'failed'} via ${result.backend} (${result.durationMs}ms)`,
        result.ok ? 'success' : 'error'
      )
      return result
    } catch (err) {
      setState({ char: 'error', status: 'Shoya error' })
      activity.log('shoya', `Shoya error: ${(err as Error).message}`, 'error')
      return { ok: false, backend: 'opencode', providerId: '', output: (err as Error).message, durationMs: 0, truncated: false }
    }
  })
  ipcMain.handle('shoya:launch', (_e, projectDir?: string) => {
    launchShoyaTerminal({ projectDir })
    activity.log('shoya', 'Shoya terminal launched')
    return true
  })
  ipcMain.handle('router:route', async (_e, text: string) => {
    const result = await routeTask(text)
    activity.log('router', `Routed "${text.slice(0, 60)}" → ${result.target} (${result.ok ? 'ok' : 'failed'})`)
    return result
  })
  ipcMain.handle('context:gather', (_e, projectDir?: string) => gatherCodingContext(projectDir))
  ipcMain.handle('context:block', (_e, projectDir?: string) => {
    return gatherCodingContext(projectDir).then(contextBlock)
  })
  ipcMain.handle('vscode:status', () => vscodeStatus())
  ipcMain.handle('vscode:open', (_e, path: string) => openInVSCodeImpl(path))
  ipcMain.handle('vscode:openFile', (_e, file: string) => openFileInVSCode(file))
  ipcMain.handle('vscode:openTerminal', (_e, dir: string) => openTerminalInVSCode(dir))
  ipcMain.handle('research:run', async (_e, query: string) => {
    const result = await doResearch(query)
    activity.log('research', `Research "${query.slice(0, 60)}" → ${result.ok ? result.sources.length + ' sources' : 'no results'}`)
    return result
  })
  ipcMain.handle('research:news', async (_e, topics?: string[]) => {
    const result = await researchNews(topics)
    activity.log('research', `News fetched: ${result.items.length} items (${result.online ? 'online' : 'offline'})`)
    return result
  })
  async function runChat(target: WebContents | null, text: string): Promise<string> {
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
      const projectNotes = memory.projectContext(c.activeProject)
      const parts = [c.chat.systemPrompt]
      if (c.activeProject && projectNotes) {
        parts.push(`Active project: ${c.activeProject}\nProject notes:\n${projectNotes}`)
      } else if (c.activeProject) {
        parts.push(`Active project: ${c.activeProject}`)
      }
      if (recall) parts.push(`Relevant memories from earlier conversations:\n${recall}`)
      const system = parts.join('\n\n')
      const history: ChatMessage[] = [{ role: 'system', content: system }]

      const turns = session ? session.turns : []
      const recent = turns.slice(-12)
      const older = turns.slice(0, -12)
      if (older.length > 0) {
        const olderText = older
          .map((t) => `${t.role === 'user' ? 'User' : 'LUNA'}: ${t.content}`)
          .join('\n')
          .slice(0, 4000)
        try {
          const summary = await ollamaChat(
            c.ollamaUrl,
            model,
            [
              {
                role: 'system',
                content:
                  'Summarize this earlier conversation concisely (2-4 sentences), keeping key facts, user preferences and open requests.'
              },
              { role: 'user', content: olderText }
            ],
            { temperature: 0.2, maxTokens: 512 }
          )
          if (summary) history.push({ role: 'system', content: `Conversation summary so far:\n${summary}` })
        } catch {
          history.push({ role: 'system', content: `Earlier context:\n${olderText.slice(0, 1200)}` })
        }
      }
      for (const t of recent) history.push({ role: t.role, content: t.content })
      history.push({ role: 'user', content: text })

      if (session) sessions.appendTurn(currentSessionId, 'user', text)
      setState({ char: 'thinking', status: 'Thinking...', activeModel: model })
      activity.log('chat', `Message to ${model} (session ${currentSessionId.slice(0, 8)})`)
      const reply = await ollamaChatStream(
        c.ollamaUrl,
        model,
        history,
        (chunk) => {
          if (target && !target.isDestroyed()) target.send('chat:token', chunk)
        },
        { temperature: c.chat.temperature, maxTokens: c.chat.maxTokens }
      )
      if (session) sessions.appendTurn(currentSessionId, 'assistant', reply)
      setState({ char: 'idle', status: 'Ready to assist...', activeModel: model })
      speakTo(target, reply, c.character.luna.speaking)
      return reply
    } catch (err) {
      activity.log('chat', `Chat error: ${(err as Error).message}`, 'error')
      setState({ char: 'idle', status: 'Chat error' })
      return `Error: ${(err as Error).message}`
    }
  }
  ipcMain.handle('chat', (event, text: string) => runChat(event.sender, text))
  ipcMain.handle('sessions:list', (): LunaSession[] => sessions.list())
  ipcMain.handle('sessions:current', (): LunaSession => {
    if (!currentSessionId || !sessions.get(currentSessionId)) {
      currentSessionId = sessions.create().id
    }
    return sessions.get(currentSessionId) as LunaSession
  })
  ipcMain.handle('sessions:new', (_e, name?: string): LunaSession => {
    currentSessionId = sessions.create(name).id
    activity.log('chat', 'New conversation started')
    return sessions.get(currentSessionId) as LunaSession
  })
  ipcMain.handle('sessions:save', (_e, id: string): boolean => {
    const ok = sessions.save(id)
    if (ok) activity.log('chat', 'Conversation saved')
    return ok
  })
  ipcMain.handle('sessions:unsave', (_e, id: string): boolean => {
    const ok = sessions.unsave(id)
    if (ok) activity.log('chat', 'Conversation unsaved (back to temp)')
    return ok
  })
  ipcMain.handle('sessions:remove', (_e, id: string): boolean => {
    const ok = sessions.remove(id)
    if (ok && id === currentSessionId) currentSessionId = ''
    if (ok) activity.log('chat', 'Conversation removed')
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
    ): MemoryEntry => {
      const e = memory.add(input)
      activity.log('memory', `Remembered (${e.tier}${e.project ? ` · ${e.project}` : ''})`)
      return e
    }
  )
  ipcMain.handle('memory:search', (_e, query: string): MemoryEntry[] => memory.search(query))
  ipcMain.handle('memory:delete', (_e, id: string): boolean => {
    const ok = memory.delete(id)
    if (ok) activity.log('memory', 'Memory entry deleted')
    return ok
  })
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
  ipcMain.handle('float:clickThrough', (_e, flag: boolean) => {
    if (floatWindow && !floatWindow.isDestroyed()) floatWindow.setIgnoreMouseEvents(flag, { forward: true })
    const c = loadConfig()
    saveConfig({ ...c, float: { ...c.float, clickThrough: flag } })
    return true
  })
  ipcMain.handle('float:reposition', (_e, x: number, y: number) => {
    if (floatWindow && !floatWindow.isDestroyed()) floatWindow.setPosition(Math.round(x), Math.round(y))
    return true
  })
  ipcMain.handle('float:resize', (_e, w: number, h: number) => {
    if (floatWindow && !floatWindow.isDestroyed())
      floatWindow.setSize(Math.max(220, Math.round(w)), Math.max(320, Math.round(h)))
    return true
  })
  ipcMain.on('permission:response', (_e, p: { action: string; approved: boolean }) => {
    activity.log(
      'permission',
      `${p.approved ? 'Approved' : 'Denied'}: ${p.action}`,
      p.approved ? 'success' : 'warn'
    )
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('permission:resolved', p)
    }
  })
  ipcMain.on('voice:input', (_e, p: { text: string; language: string }) => {
    activity.log('voice', `Voice input (${p.language}): ${p.text.slice(0, 120)}`)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('voice:heard', p)
    }
  })
  ipcMain.on(
    'voice:audio',
    async (event, p: { wavBase64: string; sampleRate: number; language?: string }) => {
      const c = loadConfig()
      if (!p || typeof p.wavBase64 !== 'string' || !p.wavBase64) return
      if (!whisperAvailable(c.aiRoot)) {
        activity.log('voice', 'STT unavailable — whisper-cli or model not found', 'warn')
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed())
            win.webContents.send('voice:heard', { text: '', language: '' })
        }
        return
      }
      const tmpPath = path.join(app.getPath('temp'), `luna-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`)
      try {
        await fs.promises.writeFile(tmpPath, Buffer.from(p.wavBase64, 'base64'))
        const hint = p.language || c.voice.language
        const result = await transcribeWav(c.aiRoot, tmpPath, { language: hint })
        const heard = { text: result.text, language: result.language }
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('voice:heard', heard)
        }
        if (result.text.trim()) {
          activity.log('voice', `Heard (${result.language}): ${result.text.slice(0, 120)}`)
          setState({ char: 'listening', status: 'Heard — thinking...', subtitle: result.text.slice(0, 160) })
          const reply = await runChat(event.sender, result.text)
          setState({ char: 'idle', status: 'Ready to assist...', subtitle: reply.slice(0, 160) })
        } else {
          activity.log('voice', 'Voice heard — nothing transcribed')
        }
      } catch (err) {
        activity.log('voice', `STT error: ${(err as Error).message}`, 'error')
      } finally {
        try {
          await fs.promises.unlink(tmpPath)
        } catch {
          // temp file already gone
        }
      }
    }
  )
  ipcMain.on('hotkey:pressed', (_e, key: string) => {
    activity.log('hotkey', `Hotkey pressed: ${key}`)
  })
  ipcMain.on('character:set', (_e, p: { character: string; state: string }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('character:setState', p)
    }
  })
  ipcMain.on('ai:switch', (_e, p: { active: 'luna' | 'shoya' }) => {
    const c = loadConfig()
    saveConfig({ ...c, activeAi: p.active })
    activity.log('ai', `Active AI switched to ${p.active === 'luna' ? 'LUNA' : 'Shoya'}`)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('ai:switched', p)
    }
  })
  ipcMain.handle('tts:status', (): TtsStatus => {
    const c = loadConfig()
    const available = !!findPiperExe(c.aiRoot)
    return {
      available,
      engine: available ? 'piper' : 'none',
      voice: c.character.luna.speaking,
      sampleRate: voiceSampleRate(c.aiRoot, c.character.luna.speaking || 'en_US-amy-medium'),
      settings: { ...c.tts }
    }
  })
  ipcMain.handle('tts:speak', (event, text: string, voice?: string) => {
    const c = loadConfig()
    speakTo(event.sender, text, voice || c.character.luna.speaking)
  })
  ipcMain.handle('tts:stop', () => {
    stopTts()
    return true
  })
  ipcMain.handle('tts:done', () => {
    setState({ char: 'idle', status: 'Ready to assist...' })
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('tts:ended')
    }
    return true
  })
  ipcMain.on('tts:level', (_e, level: number) => {
    const v = Math.max(0, Math.min(1, level))
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('tts:level', v)
    }
  })

  openDashboard()
  void refreshOllama()
  setInterval(refreshOllama, 15000)

  if (cfg.background.startMinimized) dashboard?.hide()
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
