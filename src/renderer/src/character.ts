import type { CharState } from '../../shared/types'

export interface Character2D {
  el: HTMLElement
  setState(s: CharState): void
  setMouth(level: number): void
  setImage(src: string): void
  setCaption(text: string): void
  setActivities(list: string[]): void
  highlight(active: boolean): void
}

// Chroma-key a flat near-solid background out of an image (canvas pass).
// Used for the floating-window busts (img1/img2) which ship with a beige
// backdrop and no alpha channel. Flood-fills only from the image borders so
// similar-colored pixels inside the character (skin, hair) are preserved.
export async function removeFlatBackground(
  src: string,
  keyColor: [number, number, number],
  tolerance = 42
): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve(src)
        return
      }
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      const px = data.data
      const w = c.width
      const h = c.height
      const [kr, kg, kb] = keyColor
      const thresh = tolerance * 3
      const seen = new Uint8Array(w * h)
      const stack: number[] = []

      const isBg = (i: number): boolean => {
        const r = px[i]
        const g = px[i + 1]
        const b = px[i + 2]
        return Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb) < thresh
      }

      const push = (x: number, y: number): void => {
        if (x < 0 || y < 0 || x >= w || y >= h) return
        const idx = y * w + x
        if (seen[idx]) return
        seen[idx] = 1
        stack.push(idx)
      }

      for (let x = 0; x < w; x++) push(x, 0)
      for (let x = 0; x < w; x++) push(x, h - 1)
      for (let y = 0; y < h; y++) push(0, y)
      for (let y = 0; y < h; y++) push(w - 1, y)

      while (stack.length) {
        const idx = stack.pop() as number
        if (!isBg(idx * 4)) continue
        px[idx * 4 + 3] = 0
        const x = idx % w
        const y = (idx / w) | 0
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)
      }

      ctx.putImageData(data, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

const DEFAULT_ACTIVITIES: Record<CharState, string[]> = {
  idle: ['Ready to assist', 'Listening for your voice', 'All caught up'],
  listening: ['Listening...', 'Hearing you clearly', 'Go on...'],
  thinking: ['Thinking...', 'Working through that', 'Considering options'],
  speaking: ['Speaking', 'Replying...', 'Telling you something'],
  happy: ['Happy to help', 'That worked great', 'Glad it went well'],
  confused: ['Hmm, not sure about that', 'Let me think...', 'Could you clarify?'],
  working: ['Working on it', 'Running a task', 'Almost done'],
  coding: ['Writing code', 'Reviewing the code', 'Debugging...'],
  searching: ['Searching...', 'Looking that up', 'Scanning sources'],
  explaining: ['Let me explain...', 'Here is how it works', 'Step by step:'],
  pointing: ['Right there', 'Look here', 'That one'],
  waiting: ['Waiting on that...', 'Give it a moment', 'Standing by'],
  error: ['Something went wrong', 'Let me fix that', 'Error — checking'],
  success: ['Done!', 'All set', 'Completed successfully'],
  goodbye: ['Goodbye', 'See you later', 'Take care']
}

const CYCLE_MS = 3500

export function createCharacter2D(opts: {
  name: string
  accent: 'violet' | 'cyan'
  art?: string
  variant?: 'card' | 'portrait'
}): Character2D {
  const el = document.createElement('div')
  el.className = `char2d ${opts.accent}${opts.variant === 'portrait' ? ' portrait' : ''}`
  el.dataset.state = 'idle'
  el.innerHTML = `
    <div class="char2d-glow"></div>
    <div class="char2d-art"><img alt="${opts.name}" ${opts.art ? `src="${opts.art}"` : ''} /></div>
    <div class="char2d-name">${opts.name}</div>
    <div class="char2d-caption">Ready to assist...</div>
    <div class="char2d-eq"><span></span><span></span><span></span><span></span><span></span></div>
  `

  const art = el.querySelector('.char2d-art img') as HTMLImageElement
  const caption = el.querySelector('.char2d-caption') as HTMLElement

  let activities = DEFAULT_ACTIVITIES.idle
  let cycleIdx = 0
  let interval: ReturnType<typeof setInterval> | undefined
  let manual = false

  const cycle = (): void => {
    if (manual || activities.length === 0) return
    caption.textContent = activities[cycleIdx % activities.length]
    cycleIdx++
  }

  const restartCycle = (): void => {
    if (interval) clearInterval(interval)
    cycleIdx = 0
    cycle()
    interval = setInterval(cycle, CYCLE_MS)
  }

  return {
    el,
    setState(s) {
      el.dataset.state = s
      activities = DEFAULT_ACTIVITIES[s]
      if (s !== 'idle') restartCycle()
      el.classList.remove('state-switch')
      void el.offsetWidth
      el.classList.add('state-switch')
    },
    setMouth(level) {
      const bars = el.querySelectorAll('.char2d-eq span')
      bars.forEach((b, i) => {
        const h = level > 0 ? 0.35 + Math.abs(Math.sin(i * 2.1 + level * 9)) * 0.65 : 0
        ;(b as HTMLElement).style.height = `${h * 100}%`
      })
    },
    setImage(src) {
      if (src) {
        art.src = src
        art.classList.add('loaded')
      }
    },
    setCaption(text) {
      if (text) {
        manual = true
        caption.textContent = text
      } else {
        manual = false
        cycle()
      }
    },
    setActivities(list) {
      activities = list
      manual = false
      restartCycle()
    },
    highlight(active) {
      el.classList.toggle('active', active)
    }
  }
}
