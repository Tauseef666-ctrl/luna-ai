import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from './config'
import { providerChat } from './providers'
import { ollamaChat, ollamaHealth } from './ollama'

export interface ResearchSource {
  title: string
  url: string
  snippet: string
}

export interface ResearchResult {
  ok: boolean
  online: boolean
  offline: boolean
  query: string
  sources: ResearchSource[]
  summary: string
  error?: string
}

export interface NewsItem {
  topic: string
  title: string
  url: string
  summary: string
}

export interface NewsResult {
  ok: boolean
  online: boolean
  items: NewsItem[]
  error?: string
}

const NEWS_PRIORITY = [
  'India',
  'Uttar Pradesh',
  'Technology',
  'Education',
  'Science',
  'AI',
  'World',
  'Business',
  'Gaming'
]

const INDIA_NEWS_SOURCES = [
  'https://timesofindia.indiatimes.com',
  'https://www.ndtv.com',
  'https://indianexpress.com',
  'https://www.hindustantimes.com',
  'https://www.bbc.com/news/topics/c302m85q5lvt'
]

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LUNA/0.4' },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function extractSources(html: string, baseUrl: string, max: number): ResearchSource[] {
  const sources: ResearchSource[] = []
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]{10,120})<\/a>/g
  let m: RegExpExecArray | null
  let count = 0
  while ((m = linkRe.exec(html)) !== null && count < max * 3) {
    count++
    let href = m[1]
    if (href.startsWith('/')) href = new URL(href, baseUrl).toString()
    if (!/^https?:\/\//i.test(href)) continue
    const title = stripHtml(m[2])
    if (title.length < 10) continue
    sources.push({ title, url: href, snippet: title })
    if (sources.length >= max) break
  }
  return dedupeSources(sources)
}

function dedupeSources(list: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>()
  const out: ResearchSource[] = []
  for (const s of list) {
    const key = s.url.split('#')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function offlineDocsSearch(query: string): ResearchSource[] {
  const cfg = loadConfig()
  const docsDir = join(cfg.aiRoot, 'reference')
  const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const matches: ResearchSource[] = []
  try {
    const files = readdirSync(docsDir).filter((f) => /\.(md|txt|json)$/i.test(f))
    for (const f of files.slice(0, 40)) {
      const text = readFileSync(join(docsDir, f), 'utf8').slice(0, 20000)
      const lower = text.toLowerCase()
      const hits = terms.filter((t) => lower.includes(t)).length
      if (hits >= Math.max(1, Math.floor(terms.length / 2))) {
        const positions = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)
        const idx = positions[0] ?? 0
        const snippet = text.slice(Math.max(0, idx - 80), idx + 240).replace(/\s+/g, ' ')
        matches.push({ title: f, url: `file:///${join(docsDir, f).replace(/\\/g, '/')}`, snippet })
      }
    }
  } catch {
    // no local docs
  }
  return matches.slice(0, 5)
}

async function summarizeWith(text: string, prompt: string): Promise<string> {
  const cfg = loadConfig()
  const ok = await ollamaHealth(cfg.ollamaUrl)
  if (ok) {
    try {
      const models = await (await import('./ollama')).listOllamaModels(cfg.ollamaUrl)
      const model = models.find((m) => m.name.startsWith('qwen2.5:7b'))?.name ?? models[0]?.name
      if (model) {
        const reply = await ollamaChat(cfg.ollamaUrl, model, [
          { role: 'system', content: prompt },
          { role: 'user', content: text.slice(0, 12000) }
        ], { temperature: 0.3, maxTokens: 800 })
        return reply.trim()
      }
    } catch {
      // fall through to provider
    }
  }
  const provider = Object.values(cfg.providers).find((p) => p && p.kind !== 'ollama' && p.enabled)
  if (provider) {
    try {
      const reply = await providerChat(provider, [
        { role: 'system', content: prompt },
        { role: 'user', content: text.slice(0, 12000) }
      ], { temperature: 0.3, maxTokens: 800 })
      return reply.trim()
    } catch {
      // fall through
    }
  }
  return ''
}

export async function research(query: string): Promise<ResearchResult> {
  const onlineSources: ResearchSource[] = []
  let online = false
  try {
    const html = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 10000)
    online = true
    const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]{0,300}?class="result__snippet"[^>]*>([\s\S]{0,200}?)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      onlineSources.push({
        title: stripHtml(m[2]),
        url: m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/i, ''),
        snippet: stripHtml(m[3])
      })
      if (onlineSources.length >= 5) break
    }
  } catch {
    online = false
  }

  const sources = onlineSources.length > 0 ? onlineSources : offlineDocsSearch(query)
  const offline = !online

  let summary = ''
  if (sources.length > 0) {
    const text = sources.map((s) => `- ${s.title}: ${s.snippet}`).join('\n')
    const mode = online
      ? 'Search and summarize live web results with sources, 3-5 bullet points, cite sources by number.'
      : 'Summarize from local offline documents only. State clearly this is offline knowledge, not live data.'
    summary = await summarizeWith(text, `You are LUNA's research assistant. ${mode}`)
  }

  return {
    ok: sources.length > 0,
    online,
    offline,
    query,
    sources,
    summary: summary || (sources.length === 0 ? 'No results found (online search unavailable and no local docs matched).' : '')
  }
}

export async function news(topics: string[] = []): Promise<NewsResult> {
  const active = topics.length > 0 ? topics : NEWS_PRIORITY.slice(0, 3)
  const items: NewsItem[] = []
  let online = false
  try {
    const html = await fetchWithTimeout(INDIA_NEWS_SOURCES[0], 10000)
    online = true
    const sources = extractSources(html, INDIA_NEWS_SOURCES[0], 8)
    for (const s of sources) {
      items.push({ topic: 'India', title: s.title, url: s.url, summary: s.snippet })
    }
  } catch {
    online = false
  }
  return { ok: items.length > 0 || online, online, items }
}
