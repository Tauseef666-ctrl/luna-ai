import type { OllamaModel } from '../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function ollamaHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function listOllamaModels(url: string): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = (await res.json()) as {
      models?: Array<{ name: string; size: number; modified_at: string }>
    }
    return (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at
    }))
  } catch {
    return []
  }
}

export async function ollamaChat(url: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = (await res.json()) as { message?: { content?: string } }
  const content = data.message?.content ?? ''
  if (!content) throw new Error('Empty response from Ollama')
  return content
}
