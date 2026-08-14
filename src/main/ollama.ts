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

export async function ollamaChatStream(
  url: string,
  model: string,
  messages: ChatMessage[],
  onToken: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  if (!res.body) throw new Error('No response body from Ollama')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let carry = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value, { stream: true }))
    const text = carry + chunks.join('')
    chunks.length = 0
    const lines = text.split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as { message?: { content?: string } }
        if (obj.message?.content) {
          full += obj.message.content
          onToken(obj.message.content)
        }
      } catch {
        // ignore malformed partial lines
      }
    }
  }
  if (!full) throw new Error('Empty response from Ollama')
  return full
}
