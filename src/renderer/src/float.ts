import { Color3 } from '@babylonjs/core'
import { createCharacterScene } from './character'
import type { AppState } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const character = createCharacterScene($<HTMLCanvasElement>('float-canvas'), 'half')
character.setRingColor(new Color3(0.55, 0.35, 0.95), new Color3(0.7, 0.5, 1))

let pinned = true

window.luna.onState((s: AppState) => {
  $('float-status').textContent = s.status
  $('float-subtitle').textContent = s.subtitle || ''
  character.setState(s.char)
  character.setMouth(s.char === 'speaking' ? 0.6 : 0)
})

$('btn-pin').addEventListener('click', async () => {
  pinned = !pinned
  const btn = $('btn-pin')
  btn.classList.toggle('on', pinned)
  await window.luna.float.setAlwaysOnTop(pinned)
})

$('btn-mic').addEventListener('click', () => {
  $('float-subtitle').textContent = 'Push-to-talk: press and hold the spacebar (spec 32.3)'
})

$('btn-close').addEventListener('click', () => void window.luna.float.close())

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') void window.luna.float.close()
})
