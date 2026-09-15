import { ipcMain } from 'electron'
import { loadConfig } from './config'
import { ollamaHealth, listOllamaModels } from './ollama'
import { activity } from './activity'
import { setState } from './state'
import { route as routeTask } from './router'
import { detectOpenCode, launchShoyaTerminal, runShoya } from './shoya'
import { gatherCodingContext, contextBlock } from './coding-context'
import { openFileInVSCode, openInVSCode, openTerminalInVSCode, vscodeStatus } from './vscode'
import { news as researchNews, research as doResearch } from './research'
import {
  deleteSecret,
  getSecret,
  providerChat,
  providerStatuses,
  setSecret,
  testConnection
} from './providers'
import { runChat } from './chat'
import type { ProviderConfig, ShoyaRunResult } from '../shared/types'

export function registerAiHandlers(): void {
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
    return providerChat(p, history, {
      temperature: c.chat.temperature,
      maxTokens: c.chat.maxTokens
    })
  })

  ipcMain.handle('secret:set', (_e, ref: string, value: string) => {
    const ok = setSecret(ref, value)
    activity.log(
      'security',
      ok ? `Credential saved: ${ref}` : `Failed to save credential: ${ref}`,
      ok ? 'success' : 'error'
    )
    return ok
  })
  ipcMain.handle('secret:has', (_e, ref: string): boolean => {
    if (!ref) return false
    return getSecret(ref) !== null
  })
  ipcMain.handle('secret:delete', (_e, ref: string) => {
    const ok = deleteSecret(ref)
    activity.log(
      'security',
      ok ? `Credential removed: ${ref}` : `Failed to remove credential: ${ref}`,
      ok ? 'success' : 'error'
    )
    return ok
  })

  ipcMain.handle('shoya:detect', () => {
    return detectOpenCode()
  })
  ipcMain.handle('shoya:run', async (_e, prompt: string, projectDir?: string): Promise<ShoyaRunResult> => {
    if (!prompt || !prompt.trim())
      return {
        ok: false,
        backend: 'opencode',
        providerId: '',
        output: 'Empty prompt',
        durationMs: 0,
        truncated: false
      }
    setState({ char: 'coding', status: 'Shoya is working...' })
    activity.log('shoya', `Shoya run: ${prompt.slice(0, 120)}`)
    try {
      const result = await runShoya(prompt, { projectDir })
      setState({
        char: result.ok ? 'success' : 'error',
        status: result.ok ? 'Shoya finished' : 'Shoya failed'
      })
      activity.log(
        'shoya',
        `Shoya ${result.ok ? 'completed' : 'failed'} via ${result.backend} (${result.durationMs}ms)`,
        result.ok ? 'success' : 'error'
      )
      return result
    } catch (err) {
      setState({ char: 'error', status: 'Shoya error' })
      activity.log('shoya', `Shoya error: ${(err as Error).message}`, 'error')
      return {
        ok: false,
        backend: 'opencode',
        providerId: '',
        output: (err as Error).message,
        durationMs: 0,
        truncated: false
      }
    }
  })
  ipcMain.handle('shoya:launch', (_e, projectDir?: string) => {
    launchShoyaTerminal({ projectDir })
    activity.log('shoya', 'Shoya terminal launched')
    return true
  })

  ipcMain.handle('router:route', async (_e, text: string) => {
    const result = await routeTask(text)
    activity.log(
      'router',
      `Routed "${text.slice(0, 60)}" → ${result.target} (${result.ok ? 'ok' : 'failed'})`
    )
    return result
  })

  ipcMain.handle('context:gather', (_e, projectDir?: string) => gatherCodingContext(projectDir))
  ipcMain.handle('context:block', (_e, projectDir?: string) => {
    return gatherCodingContext(projectDir).then(contextBlock)
  })

  ipcMain.handle('vscode:status', () => vscodeStatus())
  ipcMain.handle('vscode:open', (_e, path: string) => openInVSCode(path))
  ipcMain.handle('vscode:openFile', (_e, file: string) => openFileInVSCode(file))
  ipcMain.handle('vscode:openTerminal', (_e, dir: string) => openTerminalInVSCode(dir))

  ipcMain.handle('research:run', async (_e, query: string) => {
    const result = await doResearch(query)
    activity.log(
      'research',
      `Research "${query.slice(0, 60)}" → ${result.ok ? result.sources.length + ' sources' : 'no results'}`
    )
    return result
  })
  ipcMain.handle('research:news', async (_e, topics?: string[]) => {
    const result = await researchNews(topics)
    activity.log('research', `News fetched: ${result.items.length} items (${result.online ? 'online' : 'offline'})`)
    return result
  })

  ipcMain.handle('chat', (event, text: string) => runChat(event.sender, text))
}