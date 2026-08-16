import { createCharacter2D, removeFlatBackground } from './character'
import type { Character2D } from './character'
import { playWavBase64, stopAudio } from './tts-audio'
import { voiceCapture } from './voice'
import { mockBridge } from './mock-bridge'
import type {
  AiSwitchPayload,
  AppState,
  CharId,
  CharacterStatePayload,
  DigestPayload,
  LipsyncPayload,
  PermissionRequest,
  PointPayload,
  SubtitlePayload
} from '../../shared/types'

if (!window.luna) window.luna = mockBridge

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const luna = createCharacter2D({ name: 'LUNA', accent: 'violet' })
const shoya = createCharacter2D({
  name: 'Shoya',
  accent: 'cyan',
  art: ''
})

shoya.setActivities([
  'Watching over your projects',
  'Ready to debug',
  'Keeping an eye on builds',
  'Idle — call on me anytime'
])

$('float-luna').appendChild(luna.el)
$('float-shoya').appendChild(shoya.el)

let activeAi: CharId = 'luna'
luna.highlight(true)

let listening = false

async function loadArt(): Promise<void> {
  try {
    const scan = await window.luna.scan()
    const lunaRef = scan.reference.find((r) => /img1_nishimiya/i.test(r.name))
    const shoyaRef = scan.reference.find((r) => /img2_shoya/i.test(r.name))
    const [lunaRaw, shoyaRaw] = await Promise.all([
      lunaRef ? window.luna.assets.image(lunaRef.path) : Promise.resolve(''),
      shoyaRef ? window.luna.assets.image(shoyaRef.path) : Promise.resolve('')
    ])
    if (lunaRaw) {
      const cleaned = await removeFlatBackground(lunaRaw, [235, 230, 218])
      luna.setImage(cleaned)
    }
    if (shoyaRaw) {
      const cleaned = await removeFlatBackground(shoyaRaw, [235, 230, 218])
      shoya.setImage(cleaned)
    }
  } catch {
    // art is optional — silhouette placeholder renders instead
  }
}
void loadArt()

let pinned = true

const charOf = (id: CharId): Character2D => (id === 'luna' ? luna : shoya)

function setCharacterState(p: CharacterStatePayload): void {
  const c = charOf(p.character)
  c.setState(p.state)
  c.setMouth(p.state === 'speaking' ? 0.55 : 0)
  if (p.state === 'speaking') setStatus('Speaking...')
}

function setStatus(text: string): void {
  $('float-status').textContent = text
}

function setSubtitle(text: string): void {
  $('float-subtitle').textContent = text || ''
}

window.luna.onCharacterState(setCharacterState)

window.luna.onSubtitle((p: SubtitlePayload) => {
  if (p.character === activeAi || p.character === 'luna') setSubtitle(p.text)
})

window.luna.onAiSwitched((p: AiSwitchPayload) => {
  activeAi = p.active
  luna.highlight(p.active === 'luna')
  shoya.highlight(p.active === 'shoya')
  const c = charOf(p.active)
  c.el.classList.remove('switch-pop')
  void c.el.offsetWidth
  c.el.classList.add('switch-pop')
  setTimeout(() => c.el.classList.remove('switch-pop'), 750)
  toast(p.active === 'luna' ? 'Switched to LUNA.' : 'Switched to Shoya.')
  setStatus(p.active === 'luna' ? 'LUNA active' : 'Shoya active')
})

window.luna.onLipsync((p: LipsyncPayload) => {
  const c = charOf(p.character)
  const vals = p.visemeStream ?? []
  let i = 0
  const step = (): void => {
    if (i >= vals.length) {
      c.setMouth(0)
      return
    }
    c.setMouth(0.2 + Math.min(0.8, vals[i]))
    i++
    setTimeout(step, 45)
  }
  step()
})

window.luna.onPoint((p: PointPayload) => {
  const overlay = $('point-overlay')
  const x = p.targetX - window.screenX
  const y = p.targetY - window.screenY
  const label = $('point-label')
  label.textContent = p.character === 'luna' ? 'LUNA → here' : 'Shoya → here'
  overlay.hidden = false
  overlay.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, x))}px`
  overlay.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, y))}px`
  overlay.classList.remove('pulse-out')
  void overlay.offsetWidth
  overlay.classList.add('pulse-out')
  charOf(p.character).setState('pointing')
  clearTimeout((overlay as HTMLElement & { _t?: number })._t)
  ;(overlay as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
    overlay.hidden = true
    charOf(p.character).setState('idle')
  }, 3500)
})

// ---------- toasts ----------
function toast(text: string, kind = 'info'): void {
  const host = $('float-toasts')
  const t = document.createElement('div')
  t.className = `toast ${kind}`
  t.textContent = text
  host.appendChild(t)
  setTimeout(() => {
    t.classList.add('out')
    setTimeout(() => t.remove(), 350)
  }, 3200)
}

// ---------- permission dialog ----------
window.luna.onPermissionRequest((p: PermissionRequest) => {
  const dlg = $('float-permission')
  $('perm-action').textContent = p.action
  $('perm-detail').textContent =
    p.tier === 'confirm' ? (p.detail ?? 'This is a confirmation-required action.') : (p.detail ?? '')
  dlg.classList.toggle('confirm', p.tier === 'confirm')
  dlg.hidden = false
  const respond = (approved: boolean): void => {
    window.luna.permission.respond(p, approved)
    dlg.hidden = true
    toast(approved ? `Allowed: ${p.action}` : `Denied: ${p.action}`, approved ? 'success' : 'error')
  }
  $('perm-allow').onclick = () => respond(true)
  $('perm-deny').onclick = () => respond(false)
})

// ---------- notification digest ----------
window.luna.onDigest((p: DigestPayload) => {
  const host = $('float-toasts')
  const card = document.createElement('div')
  card.className = 'toast digest'
  const sum = document.createElement('span')
  sum.className = 'toast-title'
  sum.textContent = 'While you were away'
  const body = document.createElement('span')
  body.textContent = p.summary
  const list = document.createElement('ul')
  for (const it of (p.items ?? []).slice(0, 4)) {
    const li = document.createElement('li')
    li.textContent = it.title
    list.appendChild(li)
  }
  card.append(sum, body, list)
  host.appendChild(card)
  setTimeout(() => {
    card.classList.add('out')
    setTimeout(() => card.remove(), 350)
  }, 8000)
})

// ---------- real TTS audio -> lip-sync ----------
let speakingChar: CharId = 'luna'
window.luna.tts.onStarted(() => {
  speakingChar = activeAi
  setCharacterState({ character: speakingChar, state: 'speaking' })
})
window.luna.tts.onAudio((a) => {
  playWavBase64(
    a.wavBase64,
    a.sampleRate,
    (lv) => {
      charOf(speakingChar).setMouth(lv)
      setWave(lv)
    },
    () => {
      charOf(speakingChar).setMouth(0)
      setWave(0)
    }
  )
})
window.luna.tts.onEnded(() => {
  charOf(speakingChar).setMouth(0)
  setWave(0)
  setCharacterState({ character: speakingChar, state: 'idle' })
})
window.luna.tts.onError(() => {
  setStatus('Voice error')
  charOf(speakingChar).setMouth(0)
  setWave(0)
})
window.luna.tts.onLevel((v) => {
  if (listening) setWave(v)
})

// ---------- waveform ----------
let waveLevel = 0
let waveAnim = 0
const waveBars = Array.from($('float-wave').children) as HTMLElement[]

function setWave(v: number): void {
  waveLevel = Math.max(0, Math.min(1, v))
}

function waveLoop(): void {
  if (listening && waveLevel < 0.12) waveLevel = 0.1 + Math.random() * 0.18
  waveBars.forEach((b, i) => {
    const h =
      waveLevel > 0 ? 0.18 + Math.abs(Math.sin(i * 1.9 + performance.now() / 140)) * waveLevel * 0.82 : 0.06
    b.style.height = `${h * 100}%`
  })
  waveAnim = requestAnimationFrame(waveLoop)
}
waveLoop()

// ---------- legacy state fallback (until Core drives character:setState) ----------
window.luna.onState((s: AppState) => {
  setStatus(s.status)
  setSubtitle(s.subtitle || '')
  luna.setState(s.char)
  luna.setCaption(s.status)
  if (s.char !== 'speaking') luna.setMouth(0)
  const shoyaState: AppState['char'] = s.char === 'speaking' ? 'listening' : s.char
  shoya.setState(shoyaState)
  if (s.char !== 'speaking') shoya.setMouth(0)
})

// ---------- drag to move characters ----------
function makeDraggable(handle: Character2D, slot: HTMLElement, wrap: HTMLElement): void {
  const el = handle.el
  let dragging = false
  let dx = 0
  let dy = 0
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

  const toSlotSpace = (clientX: number, clientY: number): { x: number; y: number } => {
    const w = wrap.getBoundingClientRect()
    return { x: clientX - w.left, y: clientY - w.top }
  }

  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.float-toolbar')) return
    dragging = true
    el.classList.add('dragging')
    el.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    dx = e.clientX - r.left
    dy = e.clientY - r.top
    const s = toSlotSpace(r.left, r.top)
    slot.style.left = `${s.x}px`
    slot.style.top = `${s.y}px`
  })

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const w = wrap.getBoundingClientRect()
    const elR = el.getBoundingClientRect()
    const p = toSlotSpace(e.clientX, e.clientY)
    slot.style.left = `${clamp(p.x - dx, 0, w.width - elR.width)}px`
    slot.style.top = `${clamp(p.y - dy, 0, w.height - elR.height)}px`
  })

  const stop = (): void => {
    dragging = false
    el.classList.remove('dragging')
  }
  el.addEventListener('pointerup', stop)
  el.addEventListener('pointercancel', stop)
}

makeDraggable(luna, $('float-luna'), $('float-char-wrap'))
makeDraggable(shoya, $('float-shoya'), $('float-char-wrap'))

$('btn-pin').addEventListener('click', async () => {
  pinned = !pinned
  const btn = $('btn-pin')
  btn.classList.toggle('on', pinned)
  await window.luna.float.setAlwaysOnTop(pinned)
})

// ---------- character switch (⇄) ----------
$('btn-switch').addEventListener('click', () => {
  const next: CharId = activeAi === 'luna' ? 'shoya' : 'luna'
  window.luna.ai.switch(next)
})

// ---------- click-through (ghost) ----------
let ghost = false
$('btn-ghost').addEventListener('click', async () => {
  ghost = !ghost
  const btn = $('btn-ghost')
  btn.classList.toggle('on', ghost)
  await window.luna.float.clickThrough(ghost)
  setSubtitle(ghost ? 'Click-through ON — hover the bottom edge to restore' : '')
})

// exit ghost mode when the mouse reaches the bottom edge (mouse events still forwarded)
window.addEventListener('mousemove', (e) => {
  if (!ghost) return
  if (e.clientY > window.innerHeight - 40) {
    ghost = false
    $('btn-ghost').classList.remove('on')
    void window.luna.float.clickThrough(false)
    setSubtitle('')
  }
})

// ---------- microphone (click to toggle listening, Space to hold) ----------
let voiceLang = 'en'
let transcribing = false
voiceCapture.onLevel((v) => {
  if (listening) setWave(v)
})

function startListening(): void {
  if (listening) return
  void voiceCapture.start().then((ok) => {
    if (!ok) {
      toast('Microphone unavailable — check permissions', 'error')
      setStatus('Mic unavailable')
      return
    }
    listening = true
    $('btn-mic').classList.add('on')
    setSubtitle('Listening... speak now')
    setStatus('Listening...')
    charOf(activeAi).setState('listening')
    $('float-wave').classList.add('live')
    window.luna.hotkey.pressed('Space')
  })
}

function stopListening(): void {
  if (!listening) return
  listening = false
  transcribing = true
  $('btn-mic').classList.remove('on')
  $('float-wave').classList.remove('live')
  setStatus('Transcribing...')
  charOf(activeAi).setState('waiting')
  void voiceCapture.stop().then((wav) => {
    transcribing = false
    if (wav) {
      window.luna.voice.audio(wav, 16000, voiceLang)
    } else {
      setStatus('Ready to assist...')
      setSubtitle('')
      charOf(activeAi).setState('idle')
    }
  })
}

function cancelListening(): void {
  if (!listening) return
  listening = false
  $('btn-mic').classList.remove('on')
  $('float-wave').classList.remove('live')
  voiceCapture.abort()
  setStatus('Stopped')
  setSubtitle('')
  charOf(activeAi).setState('idle')
}

$('btn-mic').addEventListener('click', () => {
  if (transcribing) return
  if (listening) stopListening()
  else startListening()
})

function bargeIn(): void {
  stopAudio()
  void window.luna.tts.stop()
  cancelListening()
  setStatus('Stopped')
  setSubtitle('')
  setTimeout(() => setStatus('Ready to assist...'), 900)
}

$('btn-stop').addEventListener('click', bargeIn)

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !listening) {
    e.preventDefault()
    startListening()
  }
  if (e.code === 'Escape') {
    if (listening || $('float-subtitle').textContent) {
      bargeIn()
      return
    }
    void window.luna.float.close()
  }
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') stopListening()
})

$('btn-close').addEventListener('click', () => void window.luna.float.close())

// ---------- resize grip (bottom-right) ----------
const resizeGrip = $('float-resize')
let resizing = false
let rStartX = 0
let rStartY = 0
let rStartW = 0
let rStartH = 0

resizeGrip.addEventListener('pointerdown', (e) => {
  resizing = true
  rStartX = e.screenX
  rStartY = e.screenY
  rStartW = window.innerWidth
  rStartH = window.innerHeight
  resizeGrip.setPointerCapture(e.pointerId)
  e.preventDefault()
})

resizeGrip.addEventListener('pointermove', (e) => {
  if (!resizing) return
  const w = Math.max(300, rStartW + (e.screenX - rStartX))
  const h = Math.max(400, rStartH + (e.screenY - rStartY))
  void window.luna.float.resize(w, h)
})

const stopResize = (): void => {
  resizing = false
}
resizeGrip.addEventListener('pointerup', stopResize)
resizeGrip.addEventListener('pointercancel', stopResize)

// initial highlight + theme
void window.luna.config.get().then((c) => {
  if (c.activeAi) {
    activeAi = c.activeAi
    luna.highlight(activeAi === 'luna')
    shoya.highlight(activeAi === 'shoya')
  }
  voiceLang = c.voice?.language ?? 'en'
  document.body.dataset.theme = c.theme === 'light' ? 'light' : 'dark'
  const frame = document.querySelector('.float-frame') as HTMLElement | null
  if (frame && typeof c.float?.opacity === 'number') frame.style.opacity = String(c.float.opacity)
})
