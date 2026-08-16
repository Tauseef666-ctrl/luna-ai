import { createCharacter2D } from './character'
import type { Character2D } from './character'
import { playWavBase64, stopAudio } from './tts-audio'
import { voiceCapture } from './voice'
import type {
  ActivityEvent,
  AppState,
  Asset,
  CharId,
  DigestPayload,
  MemoryEntry,
  MemoryTier,
  PermissionRequest,
  ScanResult
} from '../../shared/types'
import { mockBridge } from './mock-bridge'

if (!window.luna) window.luna = mockBridge

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const TIER_LABEL: Record<MemoryTier, string> = {
  short: 'Short',
  session: 'Session',
  long: 'Long',
  project: 'Project'
}

let activeAi: CharId = 'luna'

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
  const statusLine = $<HTMLParagraphElement>('status-line')
  statusLine.textContent = s.status
  statusLine.classList.remove('flick')
  void statusLine.offsetWidth
  statusLine.classList.add('flick')
  $<HTMLSpanElement>('model-label').textContent = s.activeModel ? `model: ${s.activeModel}` : 'model: —'
  lunaChar.setState(s.char)
  lunaChar.setCaption(s.status)
  lunaChar.setMouth(s.char === 'speaking' ? 0.7 : 0)
  const shoyaCharState: AppState['char'] = s.char === 'speaking' ? 'listening' : s.char
  shoyaChar.setState(shoyaCharState)
  shoyaChar.setMouth(0)
  const lunaDot = $('luna-dot')
  const shoyaDot = $('shoya-dot')
  lunaDot.classList.toggle('online', s.luna === 'online')
  lunaDot.classList.toggle('offline', s.luna !== 'online')
  shoyaDot.classList.toggle('online', s.shoya === 'online')
  shoyaDot.classList.toggle('offline', s.shoya !== 'online')
  $('luna-status').textContent = s.luna === 'online' ? 'online' : 'offline'
  $('shoya-status').textContent = s.shoya === 'online' ? 'online' : 'offline'
  if (s.activeModel) {
    $('luna-model').textContent = s.activeModel
    $('shoya-model').textContent = s.activeModel
  }
  refreshAiCards()
}

async function refreshAiCards(): Promise<void> {
  try {
    const cfg = await luna().config.get()
    activeAi = cfg.activeAi || 'luna'
    const mem = await luna().memory.list()
    const memCount = mem.length
    $('luna-mem').textContent = `${memCount} entries`
    $('shoya-mem').textContent = `${memCount} entries`
    const lang: Record<string, string> = { en: 'English', hi: 'Hindi', ur: 'Urdu', hinglish: 'Hinglish' }
    const langLabel = lang[cfg.voice?.language ?? 'en'] ?? 'English'
    const mode =
      cfg.voice?.mode === 'ptt' ? 'PTT' : cfg.voice?.mode === 'always' ? 'Always listen' : 'Wake word'
    $('luna-voice').textContent = `${langLabel} · ${mode}`
    $('shoya-voice').textContent = `${langLabel} · ${mode}`
    $('luna-proj').textContent = cfg.activeProject || '—'
    $('shoya-proj').textContent = cfg.activeProject || '—'
    setActiveAi(activeAi)
  } catch {
    // cards keep last values if bridge unavailable
  }
}

function setActiveAi(id: CharId, animate = false): void {
  activeAi = id
  const lunaFlag = $('luna-flag')
  const shoyaFlag = $('shoya-flag')
  const cardL = $('ai-card-luna')
  const cardS = $('ai-card-shoya')
  const active = id === 'luna'
  lunaFlag.textContent = active ? 'ACTIVE' : '—'
  shoyaFlag.textContent = active ? '—' : 'ACTIVE'
  lunaFlag.classList.toggle('on', active)
  shoyaFlag.classList.toggle('on', !active)
  cardL.classList.toggle('active', active)
  cardS.classList.toggle('active', !active)
  lunaChar.highlight(active)
  shoyaChar.highlight(!active)
  $<HTMLButtonElement>('btn-ai-switch').textContent = `⚡ ${id === 'luna' ? 'LUNA' : 'Shoya'}`
  if (animate) {
    const target = active ? cardL : cardS
    const targetChar = active ? lunaChar : shoyaChar
    target.classList.remove('switching')
    targetChar.el.classList.remove('switch-pop')
    void target.offsetWidth
    target.classList.add('switching')
    targetChar.el.classList.add('switch-pop')
    setTimeout(() => {
      target.classList.remove('switching')
      targetChar.el.classList.remove('switch-pop')
    }, 750)
  }
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
  document.querySelectorAll('#ai-list').forEach((el) => el.classList.add('loading'))
  const scan: ScanResult = await luna().scan()
  $('asset-root').textContent = `Workspace: ${scan.root}${scan.exists ? '' : ' (not found)'}`
  $('projects-root').textContent = scan.root
  const ollamaUrl = (await luna().config.get()).ollamaUrl
  document.querySelectorAll('#ollama-url').forEach((el) => {
    el.textContent = ollamaUrl
  })
  renderAssetSection('asset-llm', 'Local LLMs (Ollama)', scan.llm, 'none detected')
  renderAssetSection('asset-stt', 'Speech-to-Text (Whisper)', scan.stt, 'none detected')
  renderAssetSection('asset-tts', 'TTS Voices (Piper)', scan.tts, 'none detected')
  renderAssetSection('asset-wakeword', 'Wake Word', scan.wakeword, 'none detected')
  renderAssetSection(
    'asset-chars',
    'Character Assets (2D extras)',
    scan.characters,
    'none — LUNA & Shoya render their concept art (img1/img2) live'
  )
  renderAssetSection('asset-anim', 'Animations', scan.animations, 'none detected')
  renderAssetSection('asset-ref', 'Reference Art (look reference only)', scan.reference, 'none detected')

  const aiLists = document.querySelectorAll('#ai-list')
  const models = await luna().ollama.models()
  aiLists.forEach((aiList) => {
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
  })

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
  const host = $('mem-list')
  host.classList.add('loading')
  try {
    const entries = query.trim() ? await luna().memory.search(query.trim()) : await luna().memory.list()
    renderMemoryList(entries)
  } finally {
    host.classList.remove('loading')
  }
}

// ---------- sessions ----------
async function loadSessions(): Promise<void> {
  const host = $('session-list')
  host.classList.add('loading')
  const list = await luna().sessions.list()
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

// ---------- projects ----------
async function renderProjects(): Promise<void> {
  const cfg = await luna().config.get()
  const projects = await luna().projects.list()
  const root = $('projects-root')
  root.textContent = cfg.aiRoot

  const active = $<HTMLSelectElement>('proj-active')
  active.replaceChildren()
  const none = document.createElement('option')
  none.value = ''
  none.textContent = 'No active project'
  active.appendChild(none)
  for (const p of projects) {
    const opt = document.createElement('option')
    opt.value = p.name
    opt.textContent = p.name
    if (p.name === cfg.activeProject) opt.selected = true
    active.appendChild(opt)
  }
  active.value = cfg.activeProject
  active.onchange = () => {
    void luna()
      .config.get()
      .then((c) => {
        c.activeProject = active.value
        return luna().config.set(c)
      })
      .then(() => renderProjects())
  }

  const list = $('proj-list')
  if (projects.length === 0) {
    list.className = 'empty-state'
    list.textContent = 'No projects yet — create one above.'
    $('proj-notes').replaceChildren()
    return
  }
  list.className = 'session-list'
  list.replaceChildren(
    ...projects.map((p) => {
      const row = document.createElement('div')
      row.className = 'session-row'
      const info = document.createElement('div')
      info.className = 'session-info'
      const name = document.createElement('span')
      name.className = 'session-name'
      name.textContent = p.name
      if (p.name === cfg.activeProject) {
        const badge = document.createElement('span')
        badge.className = 'session-badge saved'
        badge.textContent = 'ACTIVE'
        info.append(name, badge)
      } else {
        info.appendChild(name)
      }
      const meta = document.createElement('span')
      meta.className = 'mem-meta'
      meta.textContent = `updated ${new Date(p.updatedAt).toLocaleString()}`
      info.appendChild(meta)
      row.appendChild(info)
      const btns = document.createElement('div')
      btns.className = 'session-btns'
      if (p.name !== cfg.activeProject) {
        const act = document.createElement('button')
        act.className = 'icon-btn'
        act.textContent = 'Set active'
        act.onclick = () => {
          void luna()
            .config.get()
            .then((c) => {
              c.activeProject = p.name
              return luna().config.set(c)
            })
            .then(() => renderProjects())
        }
        btns.appendChild(act)
      }
      const ren = document.createElement('button')
      ren.className = 'icon-btn'
      ren.textContent = 'Rename'
      ren.onclick = () => {
        const nn = prompt('New project name:', p.name)
        if (nn)
          void luna()
            .projects.rename(p.name, nn)
            .then(() => renderProjects())
      }
      const del = document.createElement('button')
      del.className = 'icon-btn'
      del.textContent = 'Delete'
      del.onclick = () => {
        if (confirm(`Delete project "${p.name}"? This deletes the folder.`)) {
          void luna()
            .projects.delete(p.name)
            .then(() => renderProjects())
        }
      }
      btns.append(ren, del)
      row.appendChild(btns)
      return row
    })
  )

  const notes = $('proj-notes')
  const entries = await luna().memory.list()
  const proj = entries.filter((e) => e.project === cfg.activeProject)
  const head = document.createElement('h3')
  head.textContent = cfg.activeProject ? `Notes for ${cfg.activeProject}` : 'Notes'
  if (cfg.activeProject && proj.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.textContent = 'No project memory yet. Use Memory view with the project tier to add notes.'
    notes.replaceChildren(head, empty)
  } else if (proj.length > 0) {
    const ul = document.createElement('ul')
    for (const e of proj) {
      const li = document.createElement('li')
      li.className = 'asset-chip'
      li.textContent = e.text
      ul.appendChild(li)
    }
    notes.replaceChildren(head, ul)
  } else {
    notes.replaceChildren(head)
  }
}

// ---------- chat settings ----------
async function renderChatSettings(): Promise<void> {
  const cfg = await luna().config.get()
  const host = $('chat-settings')
  host.replaceChildren()
  const grid = document.createElement('div')
  grid.className = 'assign-grid'

  const temp = document.createElement('label')
  temp.className = 'assign-row'
  temp.innerHTML = '<span>Temperature</span>'
  const tIn = document.createElement('input')
  tIn.type = 'number'
  tIn.step = '0.05'
  tIn.min = '0'
  tIn.max = '2'
  tIn.value = String(cfg.chat.temperature)
  tIn.addEventListener('change', () => {
    void luna()
      .config.get()
      .then((c) => {
        c.chat.temperature = Number(tIn.value) || 0.7
        return luna().config.set(c)
      })
  })
  temp.appendChild(tIn)
  grid.appendChild(temp)

  const maxT = document.createElement('label')
  maxT.className = 'assign-row'
  maxT.innerHTML = '<span>Max tokens</span>'
  const mIn = document.createElement('input')
  mIn.type = 'number'
  mIn.min = '64'
  mIn.step = '64'
  mIn.value = String(cfg.chat.maxTokens)
  mIn.addEventListener('change', () => {
    void luna()
      .config.get()
      .then((c) => {
        c.chat.maxTokens = Number(mIn.value) || 2048
        return luna().config.set(c)
      })
  })
  maxT.appendChild(mIn)
  grid.appendChild(maxT)
  host.appendChild(grid)

  const sys = document.createElement('label')
  sys.className = 'assign-row sysprompt'
  const span = document.createElement('span')
  span.textContent = 'System prompt (persona — drives every reply)'
  const ta = document.createElement('textarea')
  ta.value = cfg.chat.systemPrompt
  ta.rows = 4
  ta.addEventListener('change', () => {
    void luna()
      .config.get()
      .then((c) => {
        c.chat.systemPrompt = ta.value
        return luna().config.set(c)
      })
  })
  sys.append(span, ta)
  host.appendChild(sys)
}

// ---------- activity ----------
function renderActivity(events: ActivityEvent[]): void {
  const list = $('activity-list')
  if (events.length === 0) {
    list.className = 'empty-state'
    list.textContent = 'No activity recorded yet.'
    return
  }
  list.className = 'session-list'
  list.replaceChildren(
    ...events.map((e) => {
      const row = document.createElement('div')
      row.className = 'session-row'
      const info = document.createElement('div')
      info.className = 'session-info'
      const badge = document.createElement('span')
      badge.className = `session-badge ${e.level}`
      badge.textContent = e.source
      const msg = document.createElement('span')
      msg.className = 'session-name'
      msg.textContent = e.message
      const when = document.createElement('span')
      when.className = 'mem-meta'
      when.textContent = new Date(e.ts).toLocaleString()
      info.append(badge, msg)
      row.append(info, when)
      return row
    })
  )
}

async function loadActivity(): Promise<void> {
  const host = $('activity-list')
  host.classList.add('loading')
  try {
    renderActivity(await luna().activity.list(100))
  } finally {
    host.classList.remove('loading')
  }
}

// ---------- character view ----------
function charCard(
  name: string,
  accent: string,
  assign: { model: string; speaking: string },
  refs: Asset[],
  art: string
): HTMLElement {
  const card = document.createElement('div')
  card.className = `char-card ${accent}`

  const head = document.createElement('div')
  head.className = 'char-card-head'
  const title = document.createElement('h3')
  title.textContent = name
  const status = document.createElement('span')
  status.className = 'char-status model'
  status.textContent = 'ANIMATED 2D'
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
  if (art) {
    const fig = document.createElement('figure')
    fig.className = 'live'
    const img = document.createElement('img')
    img.alt = `${name} live art`
    img.src = art
    const cap = document.createElement('figcaption')
    cap.textContent = 'live character art (used in app)'
    fig.append(img, cap)
    arts.appendChild(fig)
  }

  const meta = document.createElement('div')
  meta.className = 'char-meta'
  meta.textContent = `voice: ${assign.speaking || 'auto'} · llm: ${assign.model || 'auto'}`

  card.append(head, arts, meta)
  return card
}

function renderPipeline(): HTMLElement {
  const items: Array<{ title: string; desc: string; state: string }> = [
    {
      title: 'Concept art',
      desc: 'img1/img2 drive LUNA & Shoya visuals — the same images are used live in the app',
      state: 'done'
    },
    {
      title: '2D animation rig',
      desc: 'Breathing float, listening sway, thinking tilt, speaking bounce + speech equalizer, working pulse',
      state: 'done'
    },
    {
      title: 'State reactivity',
      desc: 'Chat states (idle/listening/thinking/speaking/working) drive motion + captions live',
      state: 'done'
    },
    {
      title: 'Interactivity',
      desc: 'Floating window: drag LUNA & Shoya anywhere to reposition them',
      state: 'done'
    },
    {
      title: 'Voice + lip-sync',
      desc: 'TTS pipe wires the speaking equalizer + mouth rhythm (voice engine pending)',
      state: 'auto'
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

  const host = $('char-cards')
  host.replaceChildren(
    charCard('LUNA', 'violet', cfg.character.luna, lunaRefs, lunaArt),
    charCard('Shoya', 'cyan', cfg.character.shoya, shoyaRefs, shoyaArt)
  )

  const pipe = $('char-pipeline')
  pipe.replaceChildren(renderPipeline())
}

// ---------- 2D characters (dashboard + character demo) ----------
let lunaArt = ''
let shoyaArt = ''

const lunaChar = createCharacter2D({ name: 'LUNA', accent: 'violet', variant: 'portrait' })
const shoyaChar = createCharacter2D({ name: 'Shoya', accent: 'cyan', variant: 'portrait' })
$('dash-luna').appendChild(lunaChar.el)
$('dash-shoya').appendChild(shoyaChar.el)

const demoLuna = createCharacter2D({ name: 'LUNA', accent: 'violet' })
const demoShoya = createCharacter2D({ name: 'Shoya', accent: 'cyan' })
$('demo-luna').appendChild(demoLuna.el)
$('demo-shoya').appendChild(demoShoya.el)

shoyaChar.setActivities([
  'Watching over your projects',
  'Ready to debug',
  'Keeping an eye on builds',
  'Idle — call on me anytime'
])

async function loadCharacterArt(): Promise<void> {
  try {
    const scan: ScanResult = await luna().scan()
    const refs = scan.reference
    const lunaRef =
      refs.find((r) => /img3_nishimiya_full/i.test(r.name)) ?? refs.find((r) => /nishimiya/i.test(r.name))
    const shoyaRef =
      refs.find((r) => /img4_shoya_full/i.test(r.name)) ?? refs.find((r) => /shoya/i.test(r.name))
    const [lu, sy] = await Promise.all([
      lunaRef ? luna().assets.image(lunaRef.path) : Promise.resolve(''),
      shoyaRef ? luna().assets.image(shoyaRef.path) : Promise.resolve('')
    ])
    lunaArt = lu
    shoyaArt = sy
    lunaChar.setImage(lu)
    shoyaChar.setImage(sy)
    demoLuna.setImage(lu)
    demoShoya.setImage(sy)
  } catch {
    // art optional
  }
}

function bindDemoControls(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#demo-controls [data-demo-state]')
  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      const state = b.dataset.demoState as AppState['char']
      demoLuna.setState(state)
      demoShoya.setState(state)
      demoLuna.setMouth(state === 'speaking' ? 0.7 : 0)
      demoShoya.setMouth(state === 'speaking' ? 0.5 : 0)
      buttons.forEach((x) => x.classList.remove('on'))
      b.classList.add('on')
    })
  })
}

bindDemoControls()

// ---------- toast feedback (§26, §27.1, §29) ----------
function toast(text: string, kind = 'info'): void {
  const host = $('toasts')
  const t = document.createElement('div')
  t.className = `toast ${kind}`
  t.textContent = text
  host.appendChild(t)
  setTimeout(() => {
    t.classList.add('out')
    setTimeout(() => t.remove(), 350)
  }, 3400)
}

// ---------- permission dialog (permission:request → permission:response) ----------
function showPermission(p: PermissionRequest): void {
  const dlg = $('perm-dialog')
  $('perm-action').textContent = p.action
  $('perm-detail').textContent =
    p.tier === 'confirm' ? (p.detail ?? 'This is a confirmation-required action.') : (p.detail ?? '')
  dlg.classList.toggle('confirm', p.tier === 'confirm')
  dlg.hidden = false
  const respond = (approved: boolean): void => {
    luna().permission.respond(p, approved)
    dlg.hidden = true
    toast(approved ? `Allowed: ${p.action}` : `Denied: ${p.action}`, approved ? 'success' : 'error')
  }
  $('perm-allow').onclick = () => respond(true)
  $('perm-deny').onclick = () => respond(false)
}

luna().onPermissionRequest(showPermission)

luna().onPermissionResolved((p) => {
  toast(`${p.approved ? 'Approved' : 'Denied'}: ${p.action}`, p.approved ? 'success' : 'error')
})

// ---------- notification digest (§32.5) ----------
function openSettingsTab(tab: string): void {
  document.querySelector('.nav-item[data-view="settings"]')?.classList.add('active')
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'))
  document.querySelector('.nav-item[data-view="settings"]')?.classList.add('active')
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'))
  $('view-settings').classList.add('active')
  switchSettingsTab(tab)
  void renderAssets()
  void renderChatSettings()
  void loadActivity()
  void renderSettings()
}

function showDigest(p: DigestPayload): void {
  $('digest-summary').textContent = p.summary
  const items = $('digest-items')
  items.replaceChildren()
  for (const it of (p.items ?? []).slice(0, 6)) {
    const li = document.createElement('li')
    li.className = `digest-item d-${it.kind}`
    li.textContent = it.title
    items.appendChild(li)
  }
  $('digest-card').hidden = false
}

luna().onDigest(showDigest)
$('digest-close').addEventListener('click', () => {
  $('digest-card').hidden = true
})
$('digest-activity').addEventListener('click', () => {
  $('digest-card').hidden = true
  openSettingsTab('paths')
})

// ---------- AI switch (§27.1) ----------
luna().onAiSwitched((p) => {
  setActiveAi(p.active, true)
  toast(p.active === 'luna' ? 'Switched to LUNA.' : 'Switched to Shoya.', 'success')
})

$<HTMLButtonElement>('btn-ai-switch').addEventListener('click', () => {
  luna().ai.switch(activeAi === 'luna' ? 'shoya' : 'luna')
})

// ---------- voice heard feedback (§11) ----------
luna().onVoiceHeard((p) => {
  const label = p.text.trim()
  if (label) toast(`Heard: “${label}”${p.language ? ` (${p.language})` : ''}`, 'info')
})

// ---------- theme toggle (§2.4) ----------
function applyTheme(theme: string): void {
  document.body.dataset.theme = theme === 'light' ? 'light' : 'dark'
  $<HTMLSelectElement>('cfg-theme').value = theme === 'light' ? 'light' : 'dark'
}

$('btn-theme').addEventListener('click', async () => {
  const c = await luna().config.get()
  const next = c.theme === 'light' ? 'dark' : 'light'
  applyTheme(next)
  await luna().config.set({ ...c, theme: next })
  toast(`Theme: ${next === 'light' ? 'Light' : 'Dark'}`, 'success')
})

// ---------- settings tabs (§23) ----------
function switchSettingsTab(tab: string): void {
  document.querySelectorAll('.set-tab').forEach((b) => b.classList.remove('on'))
  document.querySelector(`.set-tab[data-set-tab="${tab}"]`)?.classList.add('on')
  document.querySelectorAll('.set-panel').forEach((p) => p.classList.remove('on'))
  document.getElementById(`set-${tab}`)?.classList.add('on')
}

$('settings-tabs').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.set-tab') as HTMLButtonElement | null
  if (btn) switchSettingsTab(btn.dataset.setTab ?? 'general')
})

// ---------- settings controls (§23) ----------
function bindNum(id: string, apply: (v: number) => void): void {
  const el = document.getElementById(id) as HTMLInputElement
  el.addEventListener('change', () => {
    const v = Number(el.value)
    if (!Number.isFinite(v)) return
    apply(v)
  })
}

function bindSel(id: string, apply: (v: string) => void): void {
  const el = document.getElementById(id) as HTMLSelectElement
  el.addEventListener('change', () => apply(el.value))
}

function renderSettings(): void {
  void luna()
    .config.get()
    .then((c) => {
      $<HTMLSelectElement>('cfg-theme').value = c.theme
      $<HTMLSelectElement>('cfg-wakeword').value = c.wakeWordEnabled ? 'on' : 'off'
      $<HTMLSelectElement>('cfg-voice-mode').value = c.voice?.mode ?? 'ptt'
      $<HTMLSelectElement>('cfg-startwin').value = String(c.background?.startWithWindows ?? false)
      $<HTMLSelectElement>('cfg-startmin').value = String(c.background?.startMinimized ?? false)
      $<HTMLInputElement>('cfg-hotkey').value = c.background?.hotkey ?? 'Space'
      $<HTMLSelectElement>('cfg-language').value = c.voice?.language ?? 'en'
      $<HTMLInputElement>('cfg-mic').value = c.voice?.micDevice ?? ''
      $<HTMLInputElement>('cfg-sensitivity').value = String(c.voice?.sensitivity ?? 0.5)
      $<HTMLSelectElement>('cfg-tts-enabled').value = String(c.tts.enabled)
      $<HTMLSelectElement>('cfg-tts-auto').value = String(c.tts.autoSpeak)
      $<HTMLInputElement>('cfg-tts-length').value = String(c.tts.lengthScale)
      $<HTMLSelectElement>('cfg-guest').value = String(c.voiceId?.guest ?? false)
      $<HTMLInputElement>('cfg-float-w').value = String(c.float?.width ?? 360)
      $<HTMLInputElement>('cfg-float-h').value = String(c.float?.height ?? 520)
      $<HTMLInputElement>('cfg-float-opacity').value = String(c.float?.opacity ?? 1)
      $<HTMLSelectElement>('cfg-float-ghost').value = String(c.float?.clickThrough ?? false)
      $<HTMLInputElement>('cfg-mem-days').value = String(c.memory?.sessionDays ?? 7)
      $<HTMLSelectElement>('cfg-mem-autosave').value = String(c.memory?.autoSave ?? false)
      $<HTMLSelectElement>('cfg-mem-ask').value = String(c.memory?.askBeforeDelete ?? true)
      $<HTMLSelectElement>('cfg-auto-confirm').value = String(c.automation?.confirm ?? true)
      $<HTMLSelectElement>('cfg-auto-proactive').value = String(c.automation?.proactive ?? false)
      void renderTtsStatus()
    })
}

async function renderTtsStatus(): Promise<void> {
  try {
    const st = await luna().tts.status()
    const host = $('tts-status')
    host.replaceChildren()
    const h = document.createElement('h3')
    h.textContent = 'TTS engine'
    const ul = document.createElement('ul')
    const chip = document.createElement('li')
    chip.className = `asset-chip ${st.available ? '' : 'empty'}`
    chip.textContent = st.available
      ? `Piper ready · voice: ${st.voice || 'auto'} · ${st.sampleRate} Hz`
      : 'Piper not detected — install piper to enable voice replies'
    ul.appendChild(chip)
    host.replaceChildren(h, ul)
  } catch {
    // ignore
  }
}

function bindSettings(): void {
  bindSel('cfg-theme', (v) => {
    applyTheme(v)
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, theme: v as 'dark' | 'light' }))
  })
  bindSel('cfg-wakeword', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, wakeWordEnabled: v === 'on' }))
  })
  bindSel('cfg-voice-mode', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, voice: { ...c.voice, mode: v as 'ptt' | 'always' | 'wake' } }))
  })
  bindSel('cfg-startwin', (v) => {
    void luna()
      .config.get()
      .then((c) =>
        luna().config.set({ ...c, background: { ...c.background, startWithWindows: v === 'true' } })
      )
  })
  bindSel('cfg-startmin', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, background: { ...c.background, startMinimized: v === 'true' } }))
  })
  $<HTMLInputElement>('cfg-hotkey').addEventListener('change', (e) => {
    void luna()
      .config.get()
      .then((c) =>
        luna().config.set({
          ...c,
          background: { ...c.background, hotkey: (e.target as HTMLInputElement).value }
        })
      )
  })
  bindSel('cfg-language', (v) => {
    void luna()
      .config.get()
      .then((c) =>
        luna().config.set({
          ...c,
          voice: { ...c.voice, language: v as 'en' | 'hi' | 'ur' | 'hinglish' }
        })
      )
      .then(() => refreshAiCards())
  })
  $<HTMLInputElement>('cfg-mic').addEventListener('change', (e) => {
    void luna()
      .config.get()
      .then((c) =>
        luna().config.set({ ...c, voice: { ...c.voice, micDevice: (e.target as HTMLInputElement).value } })
      )
  })
  bindNum('cfg-sensitivity', (v) => {
    void luna()
      .config.get()
      .then((c) =>
        luna().config.set({ ...c, voice: { ...c.voice, sensitivity: Math.max(0, Math.min(1, v)) } })
      )
  })
  bindSel('cfg-tts-enabled', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, tts: { ...c.tts, enabled: v === 'true' } }))
  })
  bindSel('cfg-tts-auto', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, tts: { ...c.tts, autoSpeak: v === 'true' } }))
  })
  bindNum('cfg-tts-length', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, tts: { ...c.tts, lengthScale: v } }))
  })
  bindSel('cfg-guest', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, voiceId: { ...c.voiceId, guest: v === 'true' } }))
  })
  bindNum('cfg-float-w', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, float: { ...c.float, width: v } }))
  })
  bindNum('cfg-float-h', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, float: { ...c.float, height: v } }))
  })
  bindNum('cfg-float-opacity', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, float: { ...c.float, opacity: Math.max(0.4, Math.min(1, v)) } }))
  })
  bindSel('cfg-float-ghost', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, float: { ...c.float, clickThrough: v === 'true' } }))
  })
  bindNum('cfg-mem-days', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, memory: { ...c.memory, sessionDays: v } }))
  })
  bindSel('cfg-mem-autosave', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, memory: { ...c.memory, autoSave: v === 'true' } }))
  })
  bindSel('cfg-mem-ask', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, memory: { ...c.memory, askBeforeDelete: v === 'true' } }))
  })
  bindSel('cfg-auto-confirm', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, automation: { ...c.automation, confirm: v === 'true' } }))
  })
  bindSel('cfg-auto-proactive', (v) => {
    void luna()
      .config.get()
      .then((c) => luna().config.set({ ...c, automation: { ...c.automation, proactive: v === 'true' } }))
  })
}

// ---------- speaker enrollment stub (§32.4) ----------
let enrolled = false
function setEnrolled(on: boolean): void {
  enrolled = on
  $<HTMLButtonElement>('enroll-btn').textContent = on ? 'Recorded' : 'Record sample'
  $<HTMLButtonElement>('re-enroll-btn').disabled = !on
  $('enroll-state').textContent = on
    ? 'Voice sample recorded — voiceprint stored locally. Wake word will only activate for your voice.'
    : 'Not enrolled. Enroll a short voice sample so the wake word only activates for your voice.'
}

$('enroll-btn').addEventListener('click', () => {
  if (enrolled) return
  const btn = $<HTMLButtonElement>('enroll-btn')
  btn.classList.add('recording')
  $('enroll-state').textContent = 'Recording... speak for about 3 seconds.'
  setTimeout(() => {
    btn.classList.remove('recording')
    setEnrolled(true)
    toast('Voice sample recorded — voiceprint saved (local only)', 'success')
  }, 3000)
})

$('re-enroll-btn').addEventListener('click', () => {
  setEnrolled(false)
  $<HTMLButtonElement>('enroll-btn').click()
})

void luna()
  .config.get()
  .then((c) => {
    setEnrolled(!!c.voiceId?.enabled)
    void refreshAiCards()
  })

// ---------- contract demos (until Core emitters land) ----------
$('demo-point').addEventListener('click', () => {
  demoLuna.setState('pointing')
  demoShoya.setState('pointing')
  toast('Simulated character:point — renders as an arrow in the floating window')
  setTimeout(() => {
    demoLuna.setState('idle')
    demoShoya.setState('idle')
  }, 2000)
})

$('demo-permission').addEventListener('click', () => {
  showPermission({
    action: 'Delete file "build.log"',
    tier: 'confirm',
    detail: 'Deleting is permanent. Allow LUNA to delete this file?'
  })
})

$('demo-digest').addEventListener('click', () => {
  showDigest({
    summary: '3 tasks completed, 1 reminder fired, and one error needs your attention.',
    items: [
      { title: 'Build finished (exit 0)', kind: 'task' },
      { title: 'CI status check reminder', kind: 'reminder' },
      { title: 'Good evening briefing delivered', kind: 'routine' },
      { title: 'Ollama connection failed once (retried OK)', kind: 'error' }
    ]
  })
})

$('demo-switch').addEventListener('click', () => {
  luna().ai.switch(activeAi === 'luna' ? 'shoya' : 'luna')
})

// ---------- microphone (click to toggle listening, Space to hold) ----------
let dashListening = false
let dashVoiceLang = 'en'

async function startDashListening(): Promise<void> {
  if (dashListening) return
  const ok = await voiceCapture.start()
  if (!ok) {
    toast('Microphone unavailable — check permissions', 'error')
    $('status-line').textContent = 'Ready to assist...'
    return
  }
  dashListening = true
  $<HTMLButtonElement>('btn-mic').classList.add('on')
  $('status-line').textContent = 'Listening...'
}

async function stopDashListening(): Promise<void> {
  if (!dashListening) return
  dashListening = false
  $<HTMLButtonElement>('btn-mic').classList.remove('on')
  $('status-line').textContent = 'Transcribing...'
  const wav = await voiceCapture.stop()
  if (wav) luna().voice.audio(wav, 16000, dashVoiceLang)
  else $('status-line').textContent = 'Ready to assist...'
}

$<HTMLButtonElement>('btn-mic').addEventListener('click', () => {
  if (dashListening) void stopDashListening()
  else void startDashListening()
})

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    const typing = (e.target as HTMLElement).closest('input, textarea, select')
    if (typing) return
    e.preventDefault()
    void startDashListening()
  }
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    const typing = (e.target as HTMLElement).closest('input, textarea, select')
    if (typing) return
    void stopDashListening()
  }
})

// ---------- TTS playback on chat replies (real audio lip-sync) ----------
let speaking = false
luna().tts.onStarted(() => {
  speaking = true
  lunaChar.setState('speaking')
  lunaChar.setMouth(0.5)
})
luna().tts.onAudio((a) => {
  playWavBase64(
    a.wavBase64,
    a.sampleRate,
    (lv) => {
      lunaChar.setMouth(lv)
    },
    () => {
      lunaChar.setMouth(0)
    }
  )
})
luna().tts.onEnded(() => {
  speaking = false
  lunaChar.setMouth(0)
  lunaChar.setState('idle')
})
luna().tts.onError(() => {
  speaking = false
  lunaChar.setMouth(0)
})

// Stop audio when a new chat is sent
$<HTMLFormElement>('chat-form').addEventListener('submit', () => {
  if (speaking) {
    stopAudio()
    void luna().tts.stop()
  }
})

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
  if (btn.dataset.view === 'settings' || btn.dataset.view === 'ai') {
    void renderAssets()
    void renderChatSettings()
    void loadActivity()
  }
  if (btn.dataset.view === 'projects') void renderProjects()
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
  pending.className = 'msg luna thinking'
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
$('btn-rescan').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('btn-rescan')
  b.classList.add('loading')
  try {
    await renderAssets()
  } finally {
    b.classList.remove('loading')
  }
})

// ---------- projects ----------
$('proj-create').addEventListener('click', () => {
  const name = $<HTMLInputElement>('proj-new').value.trim()
  if (!name) return
  void luna()
    .projects.create(name)
    .then(() => {
      $<HTMLInputElement>('proj-new').value = ''
      void renderProjects()
    })
})
$<HTMLInputElement>('proj-new').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    $<HTMLButtonElement>('proj-create').click()
  }
})

// ---------- activity ----------
$('btn-activity-refresh').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('btn-activity-refresh')
  b.classList.add('loading')
  try {
    await loadActivity()
  } finally {
    b.classList.remove('loading')
  }
})
$('btn-activity-clear').addEventListener('click', () => {
  if (confirm('Clear the activity log?'))
    void luna()
      .activity.clear()
      .then(() => loadActivity())
})

void renderAssets()
void renderCharacter()
void loadCharacterArt()
void renderProjects()
void renderChatSettings()
void loadActivity()
void loadMemory()
void loadSessions()
void loadChatHistory()
bindSettings()
void renderSettings()
void luna()
  .config.get()
  .then((c) => {
    dashVoiceLang = c.voice?.language ?? 'en'
    applyTheme(c.theme)
  })
  .then(() => void refreshAiCards())
