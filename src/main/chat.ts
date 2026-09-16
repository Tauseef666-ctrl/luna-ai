import type { WebContents } from 'electron'
import type { ChatMessage } from './ollama'
import { ollamaChat, ollamaChatStream, ollamaHealth, listOllamaModels } from './ollama'
import { enabledProviders, providerChatStream } from './providers'
import { memory, sessions } from './memory'
import { activity } from './activity'
import { loadConfig } from './config'
import { setState } from './state'
import { speakTo } from './tts'
import { classify, route as routeTask } from './router'
import { runShoya } from './shoya'
import type { CharId, LunaSession, RouterTarget } from '../shared/types'

const CONVERSATIONAL_TARGETS = new Set<RouterTarget>(['chat', 'luna-local', 'luna-online'])

function activeCharId(): CharId {
  return loadConfig().activeAi === 'shoya' ? 'shoya' : 'luna'
}

let currentSessionId = ''

export function getCurrentSessionId(): string {
  return currentSessionId
}

export function setCurrentSessionId(id: string): void {
  currentSessionId = id
}

export function ensureCurrentSession(): LunaSession {
  if (!currentSessionId || !sessions.get(currentSessionId)) {
    currentSessionId = sessions.create().id
  }
  return sessions.get(currentSessionId) as LunaSession
}

/**
 * Unified entry point for a user message. Conversational messages go to the
 * streaming local/online model path (session, memory, TTS). Anything the
 * router classifies as a task (calendar, browser, reminder, skill, windows,
 * vscode, shoya, ...) is executed through the router map and its output is
 * streamed back as chat tokens + spoken, then recorded in the session.
 */
export async function runTaskOrChat(target: WebContents | null, text: string): Promise<string> {
  const task = classify(text)
  if (CONVERSATIONAL_TARGETS.has(task.target as RouterTarget)) {
    return runChat(target, text)
  }
  setState({ char: 'thinking', status: `Working on: ${task.target}` })
  activity.log('chat', `Routed "${text.slice(0, 60)}" → ${task.target} via router`)
  const result = await routeTask(text)
  setState({ char: result.ok ? 'success' : 'idle', status: result.ok ? 'Done' : 'Done (with issues)' })
  if (target && !target.isDestroyed()) target.send('chat:token', result.output)
  const c = loadConfig()
  speakTo(target, result.output, c.character[activeCharId()].speaking)
  const session = currentSessionId ? sessions.get(currentSessionId) : undefined
  if (session) {
    sessions.appendTurn(currentSessionId, 'user', text)
    sessions.appendTurn(currentSessionId, 'assistant', result.output)
  }
  return result.output
}

export async function runChat(target: WebContents | null, text: string): Promise<string> {
  return activeCharId() === 'shoya' ? runChatShoya(target, text) : runChatLuna(target, text)
}

async function runChatLuna(target: WebContents | null, text: string): Promise<string> {
  const c = loadConfig()
  setState({ char: 'thinking', status: 'Thinking...' })
  try {
    const ok = await ollamaHealth(c.ollamaUrl)
    if (!ok) return onlineFallback(target, text)
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

async function runChatShoya(target: WebContents | null, text: string): Promise<string> {
  const c = loadConfig()
  const online = enabledProviders().filter((p) => p.kind !== 'ollama')
  if (online.length === 0) {
    setState({ char: 'idle', status: 'Offline — no online provider for Shoya' })
    return 'Shoya is the online companion. Add an API provider in Settings → AI Models (Claude, Gemini, OpenAI-compatible) or install the OpenCode CLI to chat with Shoya.'
  }
  const p = online[0]
  const session = currentSessionId ? sessions.get(currentSessionId) : undefined
  const recall = memory.recall(text)
  const projectNotes = memory.projectContext(c.activeProject)
  const parts = [c.chat.systemPrompt.replace('LUNA', 'Shoya')]
  if (c.activeProject && projectNotes) {
    parts.push(`Active project: ${c.activeProject}\nProject notes:\n${projectNotes}`)
  } else if (c.activeProject) {
    parts.push(`Active project: ${c.activeProject}`)
  }
  if (recall) parts.push(`Relevant memories from earlier conversations:\n${recall}`)
  const history: ChatMessage[] = [{ role: 'system', content: parts.join('\n\n') }]
  const turns = session ? session.turns.slice(-12) : []
  for (const t of turns) history.push({ role: t.role, content: t.content })
  history.push({ role: 'user', content: text })
  if (session) sessions.appendTurn(currentSessionId, 'user', text)
  setState({ char: 'thinking', status: 'Shoya thinking...', activeModel: p.label })
  activity.log('chat', `Shoya message to provider ${p.id} (session ${currentSessionId.slice(0, 8)})`)
  try {
    const reply = await providerChatStream(
      p,
      history,
      { temperature: c.chat.temperature, maxTokens: c.chat.maxTokens },
      (chunk) => {
        if (target && !target.isDestroyed()) target.send('chat:token', chunk)
      }
    )
    if (session) sessions.appendTurn(currentSessionId, 'assistant', reply)
    setState({ char: 'idle', status: 'Ready to assist...', activeModel: p.label })
    speakTo(target, reply, c.character.shoya.speaking)
    return reply
  } catch (err) {
    activity.log('chat', `Shoya provider ${p.id} error: ${(err as Error).message}`, 'error')
    activity.log('chat', 'Shoya falling back to OpenCode CLI')
    try {
      const r = await runShoya(text, {
        maxOutputChars: c.chat.maxTokens * 2,
        providerId: p.id
      })
      if (r.ok) {
        if (session) sessions.appendTurn(currentSessionId, 'assistant', r.output)
        setState({ char: 'idle', status: 'Ready to assist...', activeModel: r.providerId })
        if (target && !target.isDestroyed()) target.send('chat:token', r.output)
        speakTo(target, r.output, c.character.shoya.speaking)
        return r.output
      }
      return r.output
    } catch (err2) {
      activity.log('chat', `Shoya OpenCode error: ${(err2 as Error).message}`, 'error')
      setState({ char: 'idle', status: 'Chat error' })
      return `Error: ${(err2 as Error).message}`
    }
  }
}

async function onlineFallback(target: WebContents | null, text: string): Promise<string> {
  const c = loadConfig()
  const online = enabledProviders().filter((p) => p.kind !== 'ollama')
  if (online.length === 0) {
    setState({ char: 'idle', status: 'Offline — start Ollama to chat locally' })
    return 'LUNA is offline and Ollama is not running. Start Ollama (with OLLAMA_MODELS=D:\\own-ai\\models\\ollama) to chat locally, or add an online API provider in Settings → AI Models.'
  }
  const p = online[0]
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
  const history: ChatMessage[] = [{ role: 'system', content: parts.join('\n\n') }]
  const turns = session ? session.turns.slice(-12) : []
  for (const t of turns) history.push({ role: t.role, content: t.content })
  history.push({ role: 'user', content: text })
  if (session) sessions.appendTurn(currentSessionId, 'user', text)
  setState({ char: 'thinking', status: 'Thinking (online)...', activeModel: p.label })
  activity.log('chat', `Message to online provider ${p.id} (session ${currentSessionId.slice(0, 8)})`)
  try {
    const reply = await providerChatStream(
      p,
      history,
      { temperature: c.chat.temperature, maxTokens: c.chat.maxTokens },
      (chunk) => {
        if (target && !target.isDestroyed()) target.send('chat:token', chunk)
      }
    )
    if (session) sessions.appendTurn(currentSessionId, 'assistant', reply)
    setState({ char: 'idle', status: 'Ready to assist...', activeModel: p.label })
    speakTo(target, reply, c.character.luna.speaking)
    return reply
  } catch (err) {
    activity.log('chat', `Online provider ${p.id} error: ${(err as Error).message}`, 'error')
    setState({ char: 'idle', status: 'Chat error' })
    return `Error: ${(err as Error).message}`
  }
}