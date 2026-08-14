import { createCharacterScene } from './character'
import type { AppState, Asset, MemoryEntry, MemoryTier, ScanResult } from '../../shared/types'
import { mockBridge } from './mock-bridge'

if (!window.luna) window.luna = mockBridge

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const TIER_LABEL: Record<MemoryTier, string> = {
  short: 'Short',
  session: 'Session',
  long: 'Long',
  project: 'Project'
}

function luna(): Window['luna'] {
  return window.luna
}

function applyState(s: AppState): void {
  const lunaBadge = $('luna-badge')
  const shoyaBadge = $('shoya-badge')
  lunaBadge.classList.remove('online', 'offline')
  shoyaBadge.classList.remove('online', 'offline')
  lunaBadge.classList.add(s.luna === 'online' ? 'online' : 'offline')
  shoyaBadge.classList.add(s.shoya === 'online' ? 'online' : 'offline')
  lunaBadge.textContent = s.luna === 'online' ? 'LUNA • ONLINE' : 'LUNA • OFFLINE'
  shoyaBadge.textContent = s.shoya === 'online' ? 'Shoya • ONLINE' : 'Shoya • OFFLINE'
  $<HTMLParagraphElement>('status-line').textContent = s.status
  $<HTMLSpanElement>('model-label').textContent = s.activeModel ? `model: ${s.activeModel}` : 'model: —'
  character.setState(s.char)
  character.setMouth(s.char === 'speaking' ? 0.6 : 0)
}

function addMsg(who: 'user' | 'luna', text: string): void {
  const log = $('chat-log')
  const el = document.createElement('div')
  el.className = `msg ${who}`
  const label = document.createElement('span')
  label.className = 'who'
  label.textContent = who === 'user' ? 'You' : 'LUNA'
  el.appendChild(label)
  el.appendChild(document.createTextNode(text))
  log.appendChild(el)
  log.scrollTop = log.scrollHeight
}

function renderAssetSection(id: string, title: string, assets: Asset[], empty: string): void {
  const host = $(id)
  const head = document.createElement('h3')
  head.textContent = title
  const ul = document.createElement('ul')
  if (assets.length === 0) {
    const chip = document.createElement('li')
    chip.className = 'asset-chip empty'
    chip.textContent = empty
    ul.appendChild(chip)
  } else {
    for (const a of assets) {
      const chip = document.createElement('li')
      chip.className = 'asset-chip'
      chip.title = a.path
      chip.textContent = a.name
      ul.appendChild(chip)
    }
  }
  host.replaceChildren(head, ul)
}

function makeSelect(
  options: Array<{ value: string; label: string }>,
  current: string,
  onchange: (v: string) => void
): HTMLSelectElement {
  const sel = document.createElement('select')
  const none = document.createElement('option')
  none.value = ''
  none.textContent = '— auto —'
  sel.appendChild(none)
  for (const o of options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    if (o.value === current) opt.selected = true
    sel.appendChild(opt)
  }
  sel.value = current
  sel.addEventListener('change', () => onchange(sel.value))
  return sel
}

async function renderAssignment(): Promise<void> {
  const scan: ScanResult = await luna().scan()
  const cfg = await luna().config.get()
  const llmOptions = scan.llm.map((a) => ({ value: a.name, label: a.name }))
  const voiceOptions = scan.tts.map((a) => ({ value: a.name, label: a.name }))
  const charOptions = scan.characters.map((a) => ({ value: a.path, label: a.name }))
  const host = $('assignment')
  host.replaceChildren()

  const head = document.createElement('h3')
  head.textContent = 'Active assignments (used by chat / future TTS)'
  host.appendChild(head)

  const grid = document.createElement('div')
  grid.className = 'assign-grid'
  const rows: Array<{
    label: string
    options: Array<{ value: string; label: string }>
    current: string
    apply: (v: string) => void
  }> = [
    {
      label: 'LUNA active LLM',
      options: llmOptions,
      current: cfg.character.luna.model,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.luna.model = v
            return luna().config.set(c)
          })
      }
    },
    {
      label: 'LUNA voice (TTS)',
      options: voiceOptions,
      current: cfg.character.luna.speaking,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.luna.speaking = v
            return luna().config.set(c)
          })
      }
    },
    {
      label: 'LUNA character model',
      options: charOptions,
      current: cfg.character.luna.idle,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.luna.idle = v
            return luna().config.set(c)
          })
          .then(() => character.loadModel(v))
      }
    },
    {
      label: 'Shoya active LLM',
      options: llmOptions,
      current: cfg.character.shoya.model,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.shoya.model = v
            return luna().config.set(c)
          })
      }
    },
    {
      label: 'Shoya voice (TTS)',
      options: voiceOptions,
      current: cfg.character.shoya.speaking,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.shoya.speaking = v
            return luna().config.set(c)
          })
      }
    },
    {
      label: 'Shoya character model',
      options: charOptions,
      current: cfg.character.shoya.idle,
      apply: (v) => {
        void luna()
          .config.get()
          .then((c) => {
            c.character.shoya.idle = v
            return luna().config.set(c)
          })
      }
    }
  ]
  for (const r of rows) {
    const wrap = document.createElement('label')
    wrap.className = 'assign-row'
    const span = document.createElement('span')
    span.textContent = r.label
    wrap.appendChild(span)
    wrap.appendChild(makeSelect(r.options, r.current, r.apply))
    grid.appendChild(wrap)
  }
  host.appendChild(grid)
}

async function renderAssets(): Promise<void> {
  const scan: ScanResult = await luna().scan()
  $('asset-root').textContent = `Workspace: ${scan.root}${scan.exists ? '' : ' (not found)'}`
  $('projects-root').textContent = scan.root
  $('ollama-url').textContent = (await luna().config.get()).ollamaUrl
  renderAssetSection('asset-llm', 'Local LLMs (Ollama)', scan.llm, 'none detected')
  renderAssetSection('asset-stt', 'Speech-to-Text (Whisper)', scan.stt, 'none detected')
  renderAssetSection('asset-tts', 'TTS Voices (Piper)', scan.tts, 'none detected')
  renderAssetSection('asset-wakeword', 'Wake Word', scan.wakeword, 'none detected')
  renderAssetSection(
    'asset-chars',
    '3D Characters',
    scan.characters,
    'none — placeholder rig in use (spec 32.1)'
  )
  renderAssetSection('asset-anim', 'Animations', scan.animations, 'none detected')
  renderAssetSection('asset-ref', 'Reference Art (look reference only)', scan.reference, 'none detected')

  const projects = $('projects-list')
  if (scan.projects.length === 0) {
    projects.className = 'empty-state'
    projects.textContent = 'No projects yet. Create a folder inside the workspace `projects/`.'
  } else {
    projects.className = ''
    projects.replaceChildren(
      ...scan.projects.map((p) => {
        const chip = document.createElement('li')
        chip.className = 'asset-chip'
        chip.title = p.path
        chip.textContent = p.name
        return chip
      })
    )
  }

  const aiList = $('ai-list')
  const models = await luna().ollama.models()
  if (models.length === 0) {
    aiList.className = 'empty-state'
    aiList.textContent =
      'No models reported by Ollama. Start Ollama with OLLAMA_MODELS=D:\\own-ai\\models\\ollama.'
  } else {
    aiList.className = ''
    const ul = document.createElement('ul')
    for (const m of models) {
      const chip = document.createElement('li')
      chip.className = 'asset-chip'
      chip.textContent = `${m.name} (${(m.size / 1e9).toFixed(2)} GB)`
      ul.appendChild(chip)
    }
    aiList.replaceChildren(ul)
  }

  await renderAssignment()
}

// ---------- memory ----------
function renderMemoryList(entries: MemoryEntry[]): void {
  const list = $('mem-list')
  if (entries.length === 0) {
    list.className = 'empty-state'
    list.textContent = 'No memories yet.'
    return
  }
  list.className = 'mem-list'
  list.replaceChildren(
    ...entries.map((e) => {
      const row = document.createElement('div')
      row.className = 'mem-row'
      const badge = document.createElement('span')
      badge.className = `mem-tier t-${e.tier}`
      badge.textContent = TIER_LABEL[e.tier] + (e.project ? ` · ${e.project}` : '')
      const text = document.createElement('span')
      text.className = 'mem-text'
      text.textContent = e.text
      const meta = document.createElement('span')
      meta.className = 'mem-meta'
      meta.textContent = e.expiresAt
        ? `expires ${new Date(e.expiresAt).toLocaleDateString()}`
        : new Date(e.createdAt).toLocaleString()
      const pin = document.createElement('button')
      pin.className = 'icon-btn mem-del'
      pin.title = e.saved ? 'Unpin (may expire for session tier)' : 'Save forever (no expiry)'
      pin.textContent = e.saved ? 'Unpin' : 'Pin'
      pin.addEventListener('click', () => {
        void luna()
          .memory.pin(e.id, !e.saved)
          .then(() => loadMemory($<HTMLInputElement>('mem-search').value))
      })
      const del = document.createElement('button')
      del.className = 'icon-btn mem-del'
      del.title = 'Delete'
      del.textContent = '✕'
      del.addEventListener('click', () => {
        void luna()
          .memory.delete(e.id)
          .then(() => loadMemory($<HTMLInputElement>('mem-search').value))
      })
      row.append(badge, text, meta, pin, del)
      return row
    })
  )
}

async function loadMemory(query = ''): Promise<void> {
  const entries = query.trim() ? await luna().memory.search(query.trim()) : await luna().memory.list()
  renderMemoryList(entries)
}

// ---------- sessions ----------
async function loadSessions(): Promise<void> {
  const list = await luna().sessions.list()
  const host = $('session-list')
  if (list.length === 0) {
    host.className = 'empty-state'
    host.textContent = 'No sessions yet.'
    return
  }
  host.className = 'session-list'
  host.replaceChildren(
    ...list.map((s) => {
      const row = document.createElement('div')
      row.className = 'session-row'
      const info = document.createElement('div')
      info.className = 'session-info'
      const name = document.createElement('span')
      name.className = 'session-name'
      name.textContent = s.name
      const badge = document.createElement('span')
      badge.className = `session-badge ${s.saved ? 'saved' : 'temp'}`
      badge.textContent = s.saved ? 'SAVED' : 'temp (7 days)'
      const meta = document.createElement('span')
      meta.className = 'mem-meta'
      meta.textContent = `${s.turns.length} turns · ${new Date(s.updatedAt).toLocaleString()}`
      info.append(name, badge, meta)
      const btns = document.createElement('div')
      btns.className = 'session-btns'
      const toggle = document.createElement('button')
      toggle.className = 'icon-btn'
      toggle.textContent = s.saved ? 'Unsave' : 'Save'
      toggle.title = s.saved ? 'Unsave — back to 7-day temporary session' : 'Save — keep this session forever'
      toggle.addEventListener('click', () => {
        const p = s.saved ? luna().sessions.unsave(s.id) : luna().sessions.save(s.id)
        void p.then(loadSessions)
      })
      btns.appendChild(toggle)
      const rm = document.createElement('button')
      rm.className = 'icon-btn'
      rm.textContent = 'Remove'
      rm.addEventListener('click', () => {
        if (confirm(`Remove session "${s.name}"?`)) void luna().sessions.remove(s.id).then(loadSessions)
      })
      btns.appendChild(rm)
      row.append(info, btns)
      return row
    })
  )
}

function exportMemory(): void {
  void luna()
    .memory.export()
    .then((data) => {
      const blob = new Blob([data], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'luna-memory.json'
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

// ---------- character view ----------
function charCard(
  name: string,
  accent: string,
  assign: { model: string; idle: string; speaking: string },
  refs: Asset[],
  modelDetected: boolean
): HTMLElement {
  const card = document.createElement('div')
  card.className = `char-card ${accent}`

  const head = document.createElement('div')
  head.className = 'char-card-head'
  const title = document.createElement('h3')
  title.textContent = name
  const status = document.createElement('span')
  status.className = `char-status ${modelDetected ? 'model' : 'placeholder'}`
  status.textContent = modelDetected ? '3D MODEL' : 'PLACEHOLDER'
  head.append(title, status)

  const arts = document.createElement('div')
  arts.className = 'char-arts'
  for (const r of refs) {
    const fig = document.createElement('figure')
    const img = document.createElement('img')
    img.alt = r.name
    img.title = r.name
    void luna()
      .assets.image(r.path)
      .then((u) => {
        if (u) img.src = u
      })
    const cap = document.createElement('figcaption')
    cap.textContent = r.name
    fig.append(img, cap)
    arts.appendChild(fig)
  }

  const meta = document.createElement('div')
  meta.className = 'char-meta'
  meta.textContent = `model: ${assign.idle || 'placeholder rig (spec 32.1)'} · voice: ${assign.speaking || 'auto'} · llm: ${
    assign.model || 'auto'
  }`

  card.append(head, arts, meta)
  return card
}

function renderPipeline(scan: ScanResult): HTMLElement {
  const model = scan.characters[0]
  const items: Array<{ title: string; desc: string; state: string }> = [
    {
      title: 'Concept art',
      desc: 'Loaded from reference/ — look reference only, never a runtime asset (spec 2.3)',
      state: 'done'
    },
    {
      title: '3D model',
      desc: model
        ? `Detected: ${model.name} — assign it to LUNA/Shoya in Settings`
        : 'Awaiting your model — drop a .glb / .gltf / .fbx / .vrm into characters/ and assign it in Settings',
      state: model ? 'ready' : 'wait'
    },
    {
      title: 'Rig + animations',
      desc: 'Auto-mapped on load: idle / listening / thinking / speaking / working clips picked by name',
      state: model ? 'auto' : 'wait'
    },
    {
      title: 'Lip-sync',
      desc: 'Jaw bone or ARKit visemes (jawOpen / aa) driven by TTS mouth level',
      state: model ? 'auto' : 'wait'
    },
    {
      title: 'Hand gestures & motion',
      desc: 'State-based clip switching + breathing / idle life overlay on the root',
      state: model ? 'auto' : 'wait'
    }
  ]
  const list = document.createElement('div')
  list.className = 'pipeline'
  for (const it of items) {
    const row = document.createElement('div')
    row.className = `pipe-row ${it.state}`
    const dot = document.createElement('span')
    dot.className = 'pipe-dot'
    const title = document.createElement('strong')
    title.textContent = it.title
    const desc = document.createElement('span')
    desc.textContent = it.desc
    row.append(dot, title, desc)
    list.appendChild(row)
  }
  return list
}

async function renderCharacter(): Promise<void> {
  const scan: ScanResult = await luna().scan()
  const cfg = await luna().config.get()
  const refs = scan.reference
  const lunaRefs = refs.filter((r) => /nishimiya/i.test(r.name))
  const shoyaRefs = refs.filter((r) => /shoya/i.test(r.name))
  const modelDetected = scan.characters.length > 0

  const host = $('char-cards')
  host.replaceChildren(
    charCard('LUNA', 'violet', cfg.character.luna, lunaRefs, modelDetected),
    charCard('Shoya', 'cyan', cfg.character.shoya, shoyaRefs, modelDetected)
  )

  const pipe = $('char-pipeline')
  pipe.replaceChildren(renderPipeline(scan))
}

async function initCharacter(): Promise<void> {
  const cfg = await luna().config.get()
  if (cfg.character.luna.idle) void character.loadModel(cfg.character.luna.idle)
}

const character = createCharacterScene($<HTMLCanvasElement>('luna-canvas'), 'full')

luna().onState(applyState)

// navigation
document.getElementById('nav')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.nav-item') as HTMLButtonElement | null
  if (!btn) return
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'))
  btn.classList.add('active')
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'))
  const view = $(`view-${btn.dataset.view}`)
  if (view) view.classList.add('active')
  if (btn.dataset.view === 'settings' || btn.dataset.view === 'ai') void renderAssets()
  if (btn.dataset.view === 'character') void renderCharacter()
  if (btn.dataset.view === 'memory') {
    void loadSessions()
    void loadMemory()
  }
})

// ---------- chat (sessions + streaming) ----------
async function loadChatHistory(): Promise<void> {
  const s = await luna().sessions.current()
  $('session-name').textContent = s.name
  const log = $('chat-log')
  log.replaceChildren()
  for (const t of s.turns) addMsg(t.role === 'user' ? 'user' : 'luna', t.content)
  log.scrollTop = log.scrollHeight
}

$('btn-new-chat').addEventListener('click', () => {
  void luna()
    .sessions.create()
    .then((s) => {
      $('session-name').textContent = s.name
      $('chat-log').replaceChildren()
    })
})

let pending: HTMLDivElement | null = null
let finalized = true

luna().onChatToken((chunk) => {
  if (pending && !finalized) {
    pending.appendChild(document.createTextNode(chunk))
    $('chat-log').scrollTop = $('chat-log').scrollHeight
  }
})

$<HTMLFormElement>('chat-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('chat-input')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  addMsg('user', text)
  pending = document.createElement('div')
  pending.className = 'msg luna'
  const label = document.createElement('span')
  label.className = 'who'
  label.textContent = 'LUNA'
  pending.appendChild(label)
  $('chat-log').appendChild(pending)
  finalized = false
  void luna()
    .sendChat(text)
    .then((reply) => {
      finalized = true
      pending?.replaceChildren()
      pending?.appendChild(label)
      pending?.appendChild(document.createTextNode(reply))
      $('chat-log').scrollTop = $('chat-log').scrollHeight
      pending = null
    })
})

$('btn-float').addEventListener('click', () => void luna().float.toggle())

// ---------- memory controls ----------
$<HTMLInputElement>('mem-search').addEventListener('input', (e) => {
  void loadMemory((e.target as HTMLInputElement).value)
})
$('mem-add-btn').addEventListener('click', () => {
  const text = $<HTMLInputElement>('mem-text').value.trim()
  if (!text) return
  const tier = $<HTMLSelectElement>('mem-tier').value as MemoryTier
  const project = $<HTMLInputElement>('mem-project').value.trim() || undefined
  void luna()
    .memory.add({ tier, text, project })
    .then(() => {
      $<HTMLInputElement>('mem-text').value = ''
      $<HTMLInputElement>('mem-project').value = ''
      void loadMemory()
    })
})
$<HTMLInputElement>('mem-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    $<HTMLButtonElement>('mem-add-btn').click()
  }
})
$('mem-clear-session').addEventListener('click', () => {
  void luna()
    .memory.clear('session')
    .then(() => loadMemory())
})
$('mem-clear-all').addEventListener('click', () => {
  if (confirm('Clear ALL memories? This cannot be undone.')) {
    void luna()
      .memory.clear()
      .then(() => loadMemory())
  }
})
$('mem-prune').addEventListener('click', () => {
  void luna()
    .memory.prune()
    .then(() => loadMemory())
})
$('mem-export').addEventListener('click', exportMemory)

// ---------- settings ----------
$('btn-rescan').addEventListener('click', () => void renderAssets())

void renderAssets()
void renderCharacter()
void initCharacter()
void loadMemory()
void loadSessions()
void loadChatHistory()
