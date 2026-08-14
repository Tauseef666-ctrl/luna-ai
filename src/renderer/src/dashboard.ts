import { createCharacterScene } from './character'
import type { AppState, Asset, ScanResult } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

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

async function renderAssets(): Promise<void> {
  const scan: ScanResult = await luna().scan()
  $('asset-root').textContent = `Workspace: ${scan.root}${scan.exists ? '' : ' (not found)'}`
  $('projects-root').textContent = scan.root
  $('ollama-url').textContent = (await luna().config.get()).ollamaUrl
  renderAssetSection('asset-llm', 'Local LLMs (Ollama)', scan.llm, 'none detected')
  renderAssetSection('asset-stt', 'Speech-to-Text (Whisper)', scan.stt, 'none detected')
  renderAssetSection('asset-tts', 'TTS Voices (Piper)', scan.tts, 'none detected')
  renderAssetSection('asset-wakeword', 'Wake Word', scan.wakeword, 'none detected')
  renderAssetSection('asset-chars', '3D Characters', scan.characters, 'none — placeholder rig in use (spec 32.1)')
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
    aiList.textContent = 'No models reported by Ollama. Start Ollama with OLLAMA_MODELS=D:\\own-ai\\models\\ollama.'
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
})

// chat
$<HTMLFormElement>('chat-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('chat-input')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  addMsg('user', text)
  const pending = document.createElement('div')
  pending.className = 'msg luna'
  const label = document.createElement('span')
  label.className = 'who'
  label.textContent = 'LUNA'
  pending.appendChild(label)
  pending.appendChild(document.createTextNode('...'))
  $('chat-log').appendChild(pending)
  void luna()
    .sendChat(text)
    .then((reply) => {
      pending.textContent = ''
      pending.appendChild(label)
      pending.appendChild(document.createTextNode(reply))
      $('chat-log').scrollTop = $('chat-log').scrollHeight
    })
})

$('btn-float').addEventListener('click', () => void luna().float.toggle())

void renderAssets()
