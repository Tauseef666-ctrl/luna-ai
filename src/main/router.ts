import { loadConfig } from './config'
import { runShoya } from './shoya'
import { enabledProviders, providerChat } from './providers'
import { ollamaChat, ollamaHealth } from './ollama'
import { memory } from './memory'
import { launchApp, openPath, openUrl, runCommand, listWindows, focusWindow } from './control'
import { openInVSCode } from './vscode'
import { activity } from './activity'

export type RouterTarget =
  | 'luna-local'
  | 'luna-online'
  | 'shoya'
  | 'windows'
  | 'vscode'
  | 'file'
  | 'memory'
  | 'research'
  | 'chat'

export interface RouterTask {
  target: RouterTarget
  confidence: number
  reason: string
  params: {
    projectDir?: string
    prompt?: string
    query?: string
    command?: string
    path?: string
    url?: string
    providerId?: string
    model?: string
    tier: 'safe' | 'confirm'
  }
}

export interface RouteResult {
  target: RouterTarget
  ok: boolean
  output: string
  providerId: string
}

const CODING_HINTS = [
  'write code',
  'refactor',
  'debug',
  'implement',
  'fix bug',
  'build ',
  'git ',
  'commit',
  'pull request',
  'pr ',
  'vs code',
  'terminal',
  'powershell',
  'command',
  'npm ',
  'install ',
  'test ',
  'eslint',
  'readme',
  'function',
  'class ',
  'api endpoint',
  'github',
  'repo',
  'project ',
  'continue ',
  'opencode',
  'shoya'
]

const WINDOW_HINTS = [
  'open ',
  'launch ',
  'start ',
  'focus ',
  'switch to ',
  'minimize',
  'maximize',
  'run ',
  'close ',
  'kill ',
  'which window',
  'what is open',
  'task manager'
]

const VSCode_HINTS = ['vscode', 'visual studio code', 'open in code', 'workspace', 'open project']

const MEMORY_HINTS = ['remember', 'forget', 'recall', 'memory', 'what do you know about me', 'save this']

const RESEARCH_HINTS = ['search', 'research', 'news', 'find out', 'look up', 'who is ', 'what is ', 'weather', 'latest']

const URL_HINTS = ['open website', 'browse', 'go to https://', 'open http', 'website']

function classify(text: string): RouterTask {
  const t = text.toLowerCase()
  const isMemory = MEMORY_HINTS.some((h) => t.includes(h))
  const isShoyaLike =
    t.includes('shoya') ||
    CODING_HINTS.filter((h) => h !== 'shoya').some((h) => t.includes(h))
  const isCodingExplicit = t.includes('shoya') || t.includes('opencode')
  const isWindow = WINDOW_HINTS.some((h) => t.includes(h))
  const isVscode = VSCode_HINTS.some((h) => t.includes(h))
  const isResearch = RESEARCH_HINTS.some((h) => t.includes(h))
  const url = extractUrl(text)
  const isUrl = URL_HINTS.some((h) => t.includes(h)) && Boolean(url)
  const isCommand = t.startsWith('cmd ') || t.startsWith('run command') || t.startsWith('>')

  if (isCodingExplicit)
    return { target: 'shoya', confidence: 0.98, reason: 'Explicit Shoya/OpenCode mention', params: { prompt: text, tier: 'safe' } }
  if (isMemory)
    return { target: 'memory', confidence: 0.9, reason: 'Memory intent detected', params: { prompt: text, tier: 'safe' } }
  if (isCommand)
    return { target: 'windows', confidence: 0.95, reason: 'Direct command request', params: { command: text, tier: 'confirm' } }
  if (isVscode)
    return { target: 'vscode', confidence: 0.85, reason: 'VS Code workspace intent', params: { prompt: text, tier: 'safe' } }
  if (isUrl)
    return { target: 'windows', confidence: 0.85, reason: 'URL open request', params: { url, tier: 'safe' } }
  if (isWindow)
    return { target: 'windows', confidence: 0.8, reason: 'Window/app control detected', params: { prompt: text, tier: 'confirm' } }
  if (isResearch)
    return { target: 'research', confidence: 0.75, reason: 'Research/news intent', params: { query: text, tier: 'safe' } }
  if (isShoyaLike)
    return { target: 'shoya', confidence: 0.7, reason: 'Coding/technical keywords detected', params: { prompt: text, tier: 'safe' } }
  return { target: 'chat', confidence: 0.9, reason: 'General conversation', params: { prompt: text, tier: 'safe' } }
}

function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i)
  return m ? m[0] : ''
}

async function lunaReply(text: string): Promise<RouteResult> {
  const cfg = loadConfig()
  const ok = await ollamaHealth(cfg.ollamaUrl)
  if (ok) {
    try {
      const models = await (await import('./ollama')).listOllamaModels(cfg.ollamaUrl)
      const preferred =
        models.find((m) => m.name === cfg.character.luna.model) ??
        models.find((m) => m.name.startsWith('qwen2.5:7b')) ??
        models.find((m) => m.name.startsWith('qwen2.5'))
      const model = preferred?.name ?? models[0]?.name
      if (model) {
        const reply = await ollamaChat(
          cfg.ollamaUrl,
          model,
          [{ role: 'system', content: cfg.chat.systemPrompt }, { role: 'user', content: text }],
          { temperature: cfg.chat.temperature, maxTokens: cfg.chat.maxTokens }
        )
        return { target: 'luna-local', ok: true, output: reply, providerId: `ollama/${model}` }
      }
    } catch (err) {
      activity.log('router', `Local chat failed: ${(err as Error).message}`, 'warn')
    }
  }
  // Local Ollama already failed above — skip it so the fallback actually uses
  // a remote provider instead of re-hitting the dead local server.
  const online = enabledProviders().filter((p) => p.kind !== 'ollama')
  if (online.length > 0) {
    try {
      const reply = await providerChat(
        online[0],
        [{ role: 'system', content: cfg.chat.systemPrompt }, { role: 'user', content: text }],
        { temperature: cfg.chat.temperature, maxTokens: cfg.chat.maxTokens }
      )
      return { target: 'luna-online', ok: true, output: reply, providerId: online[0].id }
    } catch (err) {
      return { target: 'chat', ok: false, output: `Error: ${(err as Error).message}`, providerId: online[0].id }
    }
  }
  return {
    target: 'chat',
    ok: false,
    output: 'LUNA is offline and no online provider is configured. Start Ollama or add an API provider in Settings → AI Models.',
    providerId: ''
  }
}

export async function route(text: string): Promise<RouteResult> {
  const task = classify(text)
  activity.log('router', `Task → ${task.target} (${Math.round(task.confidence * 100)}% ${task.reason})`)

  switch (task.target) {
    case 'shoya':
    case 'luna-local':
    case 'luna-online': {
      if (task.target === 'shoya') {
        const r = await runShoya(task.params.prompt ?? text, {
          projectDir: task.params.projectDir,
          providerId: task.params.providerId,
          model: task.params.model
        })
        return { target: 'shoya', ok: r.ok, output: r.output, providerId: r.providerId }
      }
      const r = await lunaReply(text)
      return r
    }
    case 'memory': {
      const q = task.params.prompt ?? text
      const lower = q.toLowerCase()
      if (lower.includes('remember') || lower.startsWith('remember')) {
        const entry = memory.add({ tier: 'long', text: q.replace(/^remember\s+/i, '').trim() })
        return { target: 'memory', ok: true, output: `Remembered: ${entry.text}`, providerId: 'memory' }
      }
      const results = memory.search(q)
      if (results.length === 0)
        return { target: 'memory', ok: true, output: 'No matching memories found.', providerId: 'memory' }
      const lines = results.slice(0, 5).map((e) => `- ${e.text}`).join('\n')
      return { target: 'memory', ok: true, output: `From memory:\n${lines}`, providerId: 'memory' }
    }
    case 'windows': {
      const t = task.params.prompt ?? text
      const lower = t.toLowerCase()
      if (lower.includes('open ') || lower.includes('launch ') || lower.includes('start ')) {
        const app = t.replace(/^(please\s+)?(open|launch|start)\s+/i, '').trim()
        if (task.params.url) {
          openUrl(task.params.url)
          return { target: 'windows', ok: true, output: `Opened ${task.params.url}`, providerId: 'windows' }
        }
        if (launchApp(app))
          return { target: 'windows', ok: true, output: `Launching "${app}"...`, providerId: 'windows' }
        if (/^[a-z]:[\\/]|^[\\/]{2}/i.test(app)) {
          const okPath = await openPath(app)
          return {
            target: 'windows',
            ok: okPath,
            output: okPath ? `Opened ${app}` : `Could not open "${app}"`,
            providerId: 'windows'
          }
        }
        return { target: 'windows', ok: false, output: `Could not launch "${app}"`, providerId: 'windows' }
      }
      if (lower.includes('which window') || lower.includes('what is open')) {
        const wins = await listWindows()
        const lines = wins.slice(0, 10).map((w) => `- ${w.app} (${w.title})`).join('\n')
        return { target: 'windows', ok: true, output: `Open windows:\n${lines}`, providerId: 'windows' }
      }
      if (lower.includes('focus ') || lower.includes('switch to ')) {
        const target = t.replace(/^(please\s+)?(focus on|switch to)\s+/i, '').trim()
        const wins = await listWindows()
        const match = wins.find((w) => w.app.toLowerCase().includes(target.toLowerCase()) || w.title.toLowerCase().includes(target.toLowerCase()))
        if (match) {
          const ok = await focusWindow(match.pid)
          return { target: 'windows', ok, output: ok ? `Focused ${match.app}` : `Could not focus ${target}`, providerId: 'windows' }
        }
        return { target: 'windows', ok: false, output: `No open window matching "${target}"`, providerId: 'windows' }
      }
      if (task.params.command) {
        const r = await runCommand(task.params.command)
        return { target: 'windows', ok: r.ok, output: r.output, providerId: 'windows' }
      }
      return { target: 'windows', ok: true, output: 'Windows control: specify an app to open, a window to focus, or a command.', providerId: 'windows' }
    }
    case 'vscode': {
      const cfg = loadConfig()
      const dir = cfg.activeProject
      const ok = await openInVSCode(dir || process.cwd())
      return {
        target: 'vscode',
        ok,
        output: ok ? `Opened ${dir || 'workspace'} in VS Code` : 'Could not open VS Code (not found on PATH)',
        providerId: 'vscode'
      }
    }
    case 'research':
      return {
        target: 'research',
        ok: false,
        output: `Research request: "${task.params.query ?? text}". The research backend is being wired — for now ask LUNA via chat.`,
        providerId: 'research'
      }
    default:
      return lunaReply(text)
  }
}
