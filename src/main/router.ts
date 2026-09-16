import { loadConfig } from './config'
import { runShoya } from './shoya'
import { enabledProviders, providerChat } from './providers'
import { ollamaChat, ollamaHealth } from './ollama'
import { memory } from './memory'
import { launchApp, openPath, openUrl, runCommand, listWindows, focusWindow } from './control'
import { openInVSCode } from './vscode'
import { activity } from './activity'
import { listSkills, runSkill } from './skills'
import { emitDigest } from './digest'
import { addRoutine, parseRoutine } from './routines'
import { addEvent, listUpcoming, parseWhen } from './calendar'
import { readClipboardSafe, writeClipboard } from './clipboard'
import { browserOpen, browserNavigate, browserExtract, browserFill, browserClick, browserActive } from './browser'
import { requestPermission } from './permission'
import type { RouteResult, RouterTarget } from '../shared/types'

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
    skillId?: string
    tier: 'safe' | 'confirm'
  }
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

const BROWSER_HINTS = [
  'open a browser',
  'browser session',
  'browse the web',
  'in the browser',
  'on the webpage',
  'on the page',
  'fill the form',
  'fill the field',
  'submit the form',
  'webpage',
  'web page',
  'website content',
  'open the website',
  'search the web',
  'navigate to',
  'go to http'
]

// Subsets used for action routing within the browser target.
const BROWSER_READ_HINTS = ['read the page', 'extract', 'summarize the page', 'what is on the page', 'what is on this page', 'content of the page', 'what is the title', 'what does the page say', 'page content']
const BROWSER_FILL_HINTS = ['fill the', 'type in the', 'enter the', 'type in ', 'fill ']
const BROWSER_CLICK_HINTS = ['click the', 'click ', 'press the', 'tap the', 'press button', 'click submit', 'press submit']

const DIGEST_HINTS = ['what did i miss', 'what missed', 'catch me up', 'digest', 'anything new', 'anything since', 'what happened while', 'miss anything', 'missed anything']

const REMINDER_HINTS = ['remind me', 'reminder', 'remind ', 'set a reminder', 'in 2 hours', 'in an hour', 'every weekday', 'every morning', 'every day at', 'daily at']

const CALENDAR_HINTS = ['calendar', 'schedule', 'event on', 'add an event', 'add event', 'appointment', 'what do i have', 'agenda', 'upcoming events', 'next event', 'on my calendar']

const CLIPBOARD_HINTS = ['clipboard', 'something i copied', 'what i copied', 'what did i copy', 'copy that for me', 'copy this', 'put on the clipboard', 'paste']

const EMAIL_HINTS = [
  'check email', 'check my email', 'inbox', 'read email', 'summarize my email', 'any new email',
  'send an email', 'draft a reply', 'draft an email', 'email draft', 'compose an email'
]

export function classify(text: string): RouterTask {
  const t = text.toLowerCase()
  const isMemory = MEMORY_HINTS.some((h) => t.includes(h))
  const isDigest = DIGEST_HINTS.some((h) => t.includes(h))
  const isCalendar = CALENDAR_HINTS.some((h) => t.includes(h))
  const isClipboard = CLIPBOARD_HINTS.some((h) => t.includes(h))
  const isEmail = EMAIL_HINTS.some((h) => t.includes(h))
  const isShoyaLike =
    t.includes('shoya') ||
    CODING_HINTS.filter((h) => h !== 'shoya').some((h) => t.includes(h))
  const isCodingExplicit = t.includes('shoya') || t.includes('opencode')
  const isWindow = WINDOW_HINTS.some((h) => t.includes(h))
  const isVscode = VSCode_HINTS.some((h) => t.includes(h))
  const isResearch = RESEARCH_HINTS.some((h) => t.includes(h))
  const url = extractUrl(text)
  const isUrl = URL_HINTS.some((h) => t.includes(h)) && Boolean(url)
  const isBrowserHint = BROWSER_HINTS.some((h) => t.includes(h)) || isUrl
  const hasActiveBrowserSession = browserActive()
  const isBrowserRead = BROWSER_READ_HINTS.some((h) => t.includes(h)) && hasActiveBrowserSession
  const isBrowserFill = BROWSER_FILL_HINTS.some((h) => t.includes(h)) && hasActiveBrowserSession
  const isBrowserClick = BROWSER_CLICK_HINTS.some((h) => t.includes(h)) && hasActiveBrowserSession
  const isBrowserNavigate = isUrl
  const isBrowser = isBrowserHint || isBrowserRead || isBrowserFill || isBrowserClick
  const isBrowserAction = isBrowserRead || isBrowserFill || isBrowserClick
  const isCommand = t.startsWith('cmd ') || t.startsWith('run command') || t.startsWith('>')
  const isReminder = REMINDER_HINTS.some((h) => t.includes(h))

  if (isCodingExplicit)
    return { target: 'shoya', confidence: 0.98, reason: 'Explicit Shoya/OpenCode mention', params: { prompt: text, tier: 'safe' } }
  if (isMemory)
    return { target: 'memory', confidence: 0.9, reason: 'Memory intent detected', params: { prompt: text, tier: 'safe' } }
  if (isCommand)
    return { target: 'windows', confidence: 0.95, reason: 'Direct command request', params: { command: text, tier: 'confirm' } }
  if (isReminder)
    return { target: 'routine', confidence: 0.9, reason: 'Reminder intent detected', params: { prompt: text, tier: 'safe' } }
  if (isDigest)
    return { target: 'digest', confidence: 0.9, reason: 'What did I miss intent', params: { prompt: text, tier: 'safe' } }
  if (isCalendar)
    return { target: 'calendar', confidence: 0.85, reason: 'Calendar intent detected', params: { prompt: text, tier: 'safe' } }
  if (isClipboard)
    return { target: 'clipboard', confidence: 0.85, reason: 'Clipboard intent detected', params: { prompt: text, tier: 'safe' } }
  if (isEmail)
    return { target: 'email', confidence: 0.85, reason: 'Email intent detected', params: { prompt: text, tier: 'safe' } }
  if (isBrowser)
    return {
      target: 'browser',
      confidence: 0.9,
      reason: isBrowserRead ? 'Browser extract/read intent'
        : isBrowserFill ? 'Browser form fill intent'
        : isBrowserClick ? 'Browser click intent'
        : isBrowserNavigate ? 'Browser navigate intent'
        : 'Browser automation intent',
      params: { prompt: text, url, tier: (isBrowserRead || isBrowserNavigate) ? 'safe' : 'confirm' }
    }
  if (isVscode)
    return { target: 'vscode', confidence: 0.85, reason: 'VS Code workspace intent', params: { prompt: text, tier: 'safe' } }
  if (isWindow)
    return { target: 'windows', confidence: 0.8, reason: 'Window/app control detected', params: { prompt: text, tier: 'confirm' } }
  if (isResearch)
    return { target: 'research', confidence: 0.75, reason: 'Research/news intent', params: { query: text, tier: 'safe' } }

  const skillMatch = listSkills().find(
    (s) => s.enabled && s.triggers.some((tr) => tr && t.includes(tr.toLowerCase()))
  )
  if (skillMatch)
    return {
      target: 'skill',
      confidence: 0.85,
      reason: `Skill trigger "${skillMatch.name}" matched`,
      params: { prompt: text, skillId: skillMatch.id, tier: skillMatch.permissionTier }
    }

  if (isShoyaLike)
    return { target: 'shoya', confidence: 0.7, reason: 'Coding/technical keywords detected', params: { prompt: text, tier: 'safe' } }
  return { target: 'chat', confidence: 0.9, reason: 'General conversation', params: { prompt: text, tier: 'safe' } }
}

function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i)
  return m ? m[0] : ''
}

function withNext(r: { output: string; next?: string }): string {
  return r.next ? `${r.output} Next: ${r.next}` : r.output
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
          const r = await openUrl(task.params.url)
          return { target: 'windows', ok: r.ok, output: withNext(r), providerId: 'windows' }
        }
        const r = await launchApp(app)
        if (r.ok)
          return { target: 'windows', ok: true, output: r.output, providerId: 'windows' }
        if (r.next) {
          activity.log('automation', `launchApp: ${r.output} — Next: ${r.next}`, 'warn')
          return { target: 'windows', ok: false, output: `${r.output} Next: ${r.next}`, providerId: 'windows' }
        }
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
        return { target: 'windows', ok: r.ok, output: withNext(r), providerId: 'windows' }
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
    case 'skill': {
      if (!task.params.skillId)
        return { target: 'skill', ok: false, output: 'No skill selected.', providerId: 'skill' }
      const r = await runSkill(task.params.skillId, task.params.prompt ?? text)
      return { target: 'skill', ok: r.ok, output: r.output, providerId: r.id }
    }
    case 'digest': {
      const force = true
      const p = emitDigest(force)
      if (!p)
        return {
          target: 'digest',
          ok: true,
          output: 'Nothing significant while you were away — the activity log is quiet.',
          providerId: 'digest'
        }
      const lines = p.items.map((it) => `- ${it.title}`).join('\n')
      return { target: 'digest', ok: true, output: `${p.summary}\n${lines}`, providerId: 'digest' }
    }
    case 'routine': {
      const parsed = parseRoutine(task.params.prompt ?? text)
      if (!parsed)
        return {
          target: 'routine',
          ok: false,
          output:
            'I could not parse a schedule from that. Try "remind me to push the build in 2 hours", "remind me at 3pm", or "remind me every weekday at 9am".',
          providerId: 'routine'
        }
      const r = addRoutine(parsed)
      const when =
        parsed.schedule.type === 'once'
          ? `at ${new Date(parsed.schedule.date ?? 0).toLocaleString()}`
          : `every ${parsed.schedule.type === 'weekdays' ? 'weekday' : 'day'} at ${parsed.schedule.time}`
      return {
        target: 'routine',
        ok: true,
        output: `Reminder set: "${r.text}" (${when}). I'll ping you when it fires.`,
        providerId: 'routine'
      }
    }
    case 'calendar': {
      const q = task.params.prompt ?? text
      const low = q.toLowerCase()
      const isAdd = /add\s+(an\s+)?(event|appointment|meeting)|schedule\s+(a\s+)?(event|meeting|appointment)/.test(low)
      if (isAdd) {
        const stripped = q.replace(/^(please\s+)?(add\s+(an\s+)?(event|appointment)|add\s+meeting|schedule\s+(a\s+)?(event|meeting))\s+/i, '').trim()
        // Split title from "when" on time prepositions; the first segment is the title.
        const split = stripped.match(/^(.*?)\s+(?:at|on|for)\s+(.+)$/i)
        if (split) {
          const title = split[1].trim()
          const when = parseWhen(split[2].trim())
          if (when !== null && title) {
            const approved = await requestPermission({
              action: `Add calendar event "${title}" (${new Date(when).toLocaleString()})`,
              tier: 'confirm'
            })
            if (!approved)
              return {
                target: 'calendar',
                ok: false,
                output: 'Calendar event not added — you declined the confirmation.',
                providerId: 'calendar'
              }
            const ev = addEvent({ title, start: when })
            if (ev)
              return {
                target: 'calendar',
                ok: true,
                output: `Added "${title}" to the calendar (${new Date(when).toLocaleString()}).`,
                providerId: 'calendar'
              }
          }
        }
        return {
          target: 'calendar',
          ok: false,
          output:
            'To add an event, phrase it like: "add event meeting with design at 3pm tomorrow" or "schedule a call on friday at 10am".',
          providerId: 'calendar'
        }
      }
      const upcoming = listUpcoming(8)
      if (upcoming.length === 0)
        return {
          target: 'calendar',
          ok: true,
          output: 'Your calendar is clear — nothing upcoming.',
          providerId: 'calendar'
        }
      const lines = upcoming.map((e) => `- ${new Date(e.start).toLocaleString()} · ${e.title}`).join('\n')
      return { target: 'calendar', ok: true, output: `Upcoming:\n${lines}`, providerId: 'calendar' }
    }
    case 'clipboard': {
      const q = task.params.prompt ?? text
      const low = q.toLowerCase()
      const isWrite = /copy\s+(this|that)\s+for\s+me|put\s+.*\s+on\s+the\s+clipboard|copy\s+(this|that)/.test(low)
      if (isWrite) {
        const approved = await requestPermission({
          action: `Copy "${q}" to the clipboard`,
          tier: 'confirm'
        })
        if (!approved)
          return { target: 'clipboard', ok: false, output: 'Clipboard write declined.', providerId: 'clipboard' }
        const w = writeClipboard(q)
        return {
          target: 'clipboard',
          ok: w.ok,
          output: w.ok ? 'Copied to the clipboard.' : w.reason ?? 'Could not copy.',
          providerId: 'clipboard'
        }
      }
      const r = readClipboardSafe()
      return {
        target: 'clipboard',
        ok: r.ok,
        output: r.ok ? `Clipboard contents:\n\n${r.text.slice(0, 800)}` : r.reason ?? 'Clipboard is empty.',
        providerId: 'clipboard'
      }
    }
    case 'email': {
      const q = task.params.prompt ?? text
      const low = q.toLowerCase()
      const isDraft = /draft\s+(a\s+)?(reply|email)|compose\s+an?\s+email/.test(low)
      if (isDraft)
        return {
          target: 'email',
          ok: true,
          output:
            'I can help you draft a reply, but no email account is connected yet. Say "draft a reply to [person] about [topic]" and I will compose it for your review — I never send email without your confirmation. A mail account integration is planned (Settings → AI Models).',
          providerId: 'email'
        }
      return {
        target: 'email',
        ok: false,
        output:
          'No mailbox is connected yet, so I cannot read your inbox. Hook up an email account in Settings → AI Models when the mail integration lands; drafts and send will always require your confirmation first.',
        providerId: 'email'
      }
    }
    case 'browser': {
      const q = task.params.prompt ?? text
      const low = q.toLowerCase()

      if (BROWSER_READ_HINTS.some((h) => low.includes(h))) {
        const r = await browserExtract()
        return { target: 'browser', ok: r.ok, output: r.output, providerId: 'browser' }
      }
      const fillMatch = low.match(/(?:fill|type|enter)\s+(?:the\s+)?(.+?)\s+with\s+(.+)/i)
      if (fillMatch) {
        const r = await browserFill({ field: fillMatch[1].trim(), value: fillMatch[2].trim() })
        return { target: 'browser', ok: r.ok, output: r.output, providerId: 'browser' }
      }
      const clickMatch = low.match(/(?:click|press|tap)\s+(?:the\s+)?(.+)/i)
      if (clickMatch) {
        const r = await browserClick({ element: clickMatch[1].trim() })
        return { target: 'browser', ok: r.ok, output: r.output, providerId: 'browser' }
      }
      if (task.params.url) {
        const r = await browserOpen({ url: task.params.url })
        return { target: 'browser', ok: r.ok, output: r.output, providerId: 'browser' }
      }
      return {
        target: 'browser',
        ok: false,
        output:
          'Browser automation is ready. Say "open <url>" to open a site, "read this page" to extract content, "fill the email field with ...", or "click the submit button".',
        providerId: 'browser'
      }
    }
    default:
      return lunaReply(text)
  }
}
