import type { WebContents } from 'electron'
import type { ChatMessage } from './ollama'
import { ollamaChat, ollamaChatStream, ollamaHealth, listOllamaModels } from './ollama'
import { enabledProviders, providerChat } from './providers'
import { memory, sessions } from './memory'
import { activity } from './activity'
import { loadConfig } from './config'
import { setState } from './state'
import { speakTo } from './tts'
import type { LunaSession } from '../shared/types'

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

export async function runChat(target: WebContents | null, text: string): Promise<string> {
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
    const reply = await providerChat(p, history, {
      temperature: c.chat.temperature,
      maxTokens: c.chat.maxTokens
    })
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