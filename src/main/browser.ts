import { BrowserWindow, shell } from 'electron'
import { activity } from './activity'
import { loadConfig } from './config'
import { requestPermission } from './permission'
import type { BrowserState, BrowserTabs } from '../shared/types'

let browserWin: BrowserWindow | null = null

export interface BrowserControl {
  url: string
  title: string
}

function activeUrl(): string {
  try {
    return browserWin?.webContents.getURL() ?? ''
  } catch {
    return ''
  }
}

function activeTitle(): string {
  try {
    return browserWin?.getTitle() ?? ''
  } catch {
    return ''
  }
}

function broadcast(state: BrowserState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('browser:state', state)
  }
}

function pushState(): void {
  broadcast({
    open: isBrowserOpen(),
    url: activeUrl(),
    title: activeTitle(),
    tabs: browserTabs()
  } satisfies BrowserState)
}

function isBrowserOpen(): boolean {
  return !!browserWin && !browserWin.isDestroyed() && browserWin.isVisible()
}

/**
 * Create (or reuse) the visible browser window. `visible` is always true — the
 * spec requires the user be able to watch what LUNA does on their behalf
 * (section 32.7), so this is never headless.
 */
async function ensureBrowser(): Promise<{ win: BrowserWindow; created: boolean }> {
  if (browserWin && !browserWin.isDestroyed()) {
    if (!browserWin.isVisible()) browserWin.show()
    return { win: browserWin, created: false }
  }
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'LUNA Browser',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    browserWin = null
    pushState()
  })
  win.on('page-title-updated', () => pushState())
  win.webContents.on('did-navigate', () => pushState())
  // Open target=_blank / external links with the OS browser instead of losing LUNA's session.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    activity.log('browser', `Navigate failed (${code}): ${url} — ${desc}`, 'warn')
  })
  browserWin = win
  return { win, created: true }
}

async function waitForLoad(win: BrowserWindow, timeoutMs = 15000): Promise<void> {
  if (win.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      const done = (): void => {
        win.webContents.removeListener('did-finish-load', done)
        resolve()
      }
      win.webContents.once('did-finish-load', done)
      setTimeout(done, timeoutMs)
    })
  }
}

export function browserTabs(): BrowserTabs[] {
  if (!browserWin || browserWin.isDestroyed()) return []
  try {
    const url = browserWin.webContents.getURL()
    if (!url) return []
    return [{ label: browserWin.getTitle().slice(0, 40) || url, url }]
  } catch {
    return []
  }
}

export async function browserOpen(input: { url: string }): Promise<{ ok: boolean; output: string }> {
  let url = input.url.trim()
  if (!url) return { ok: false, output: 'No URL provided.' }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const { win } = await ensureBrowser()
  try {
    await win.loadURL(url)
    await waitForLoad(win)
    const title = activeTitle()
    activity.log('browser', `Opened ${url}`)
    pushState()
    return { ok: true, output: `Opened ${title || url} in LUNA's browser.` }
  } catch (err) {
    activity.log('browser', `Open failed: ${(err as Error).message}`, 'error')
    return { ok: false, output: `Could not load ${url}: ${(err as Error).message}` }
  }
}

export async function browserNavigate(input: { url: string }): Promise<{ ok: boolean; output: string }> {
  const url = input.url.trim()
  if (!isBrowserOpen()) return { ok: false, output: 'No browser session open. Say "open <site>" first.' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, output: 'Give a full URL to navigate to.' }
  try {
    await browserWin!.loadURL(url)
    await waitForLoad(browserWin!)
    activity.log('browser', `Navigated to ${url}`)
    pushState()
    return { ok: true, output: `Navigated to ${activeTitle() || url}.` }
  } catch (err) {
    return { ok: false, output: `Navigation failed: ${(err as Error).message}` }
  }
}

async function execInPage<T>(script: string): Promise<T | null> {
  if (!browserWin || browserWin.isDestroyed()) return null
  try {
    return (await browserWin.webContents.executeJavaScript(script, true)) as T
  } catch {
    return null
  }
}

/** Read page content (text, links, inputs, buttons) — safe tier. */
export async function browserExtract(): Promise<{ ok: boolean; output: string }> {
  if (!isBrowserOpen()) return { ok: false, output: 'No browser session open. Say "open <site>" first.' }
  await waitForLoad(browserWin!)
  const data = await execInPage<{
    title: string
    url: string
    text: string
    links: string[]
    inputs: string[]
    buttons: string[]
  }>(
    `(() => {
      const $safe = (s) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, 200);
      const text = document.body ? $safe(document.body.innerText).slice(0, 4000) : '';
      const linkTxt = Array.from(document.querySelectorAll('a[href]')).slice(0, 25).map(a => $safe(a.textContent) + ' → ' + a.getAttribute('href'));
      const inTxt = Array.from(document.querySelectorAll('input, textarea, select')).slice(0, 25).map(i => (i.tagName + (i.type ? ':' + i.type : '') + (i.name ? ' [' + i.name + ']' : '') + (i.placeholder ? ' (' + i.placeholder + ')' : '')).slice(0, 120));
      const btn = Array.from(document.querySelectorAll('button, [role=button]')).slice(0, 25).map(b => $safe(b.textContent));
      return { title: document.title, url: location.href, text, links: linkTxt, inputs: inTxt, buttons: btn };
    })()`
  )
  if (!data) {
    activity.log('browser', 'Extract failed — page not readable', 'warn')
    return { ok: false, output: 'Could not read the page.' }
  }
  activity.log('browser', 'Extracted page content')
  const lines = [
    `Page: ${data.title}`,
    data.url ? `URL: ${data.url}` : '',
    data.text ? `\n${data.text}` : '',
    data.inputs.length ? `\nForm fields:\n- ${data.inputs.join('\n- ')}` : '',
    data.buttons.length ? `\nButtons:\n- ${data.buttons.join('\n- ')}` : '',
    data.links.length ? `\nLinks:\n- ${data.links.join('\n- ')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { ok: true, output: lines.slice(0, 6000) }
}

/** Fill the first input whose name/placeholder/id/type matches the description. */
export async function browserFill(input: {
  field: string
  value: string
}): Promise<{ ok: boolean; output: string }> {
  if (!isBrowserOpen()) return { ok: false, output: 'No browser session open. Say "open <site>" first.' }
  if (!input.field.trim() || !input.value) return { ok: false, output: 'Field fill needs a field description and a value.' }
  const approved = await requestPermission({
    action: `Fill "${input.field}" with "${input.value.slice(0, 80)}" in the browser`,
    tier: 'confirm'
  })
  if (!approved) return { ok: false, output: 'Form fill declined.' }

  const q = JSON.stringify(input.field.toLowerCase())
  const res = await execInPage<boolean>(
    `(() => {
      const q = ${q};
      const el = Array.from(document.querySelectorAll('input, textarea, select')).find(i =>
        (i.type && i.type.toLowerCase().includes(q)) ||
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.placeholder && i.placeholder.toLowerCase().includes(q)) ||
        (i.id && i.id.toLowerCase().includes(q))
      );
      if (!el) return false;
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      const own = Object.getOwnPropertyDescriptor(el, 'value')?.set;
      if (setter) setter.call(el, ${JSON.stringify(input.value)});
      else if (own) own.call(el, ${JSON.stringify(input.value)});
      else el.value = ${JSON.stringify(input.value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  )
  if (res) {
    activity.log('browser', `Filled "${input.field}"`)
    return { ok: true, output: `Filled "${input.field}".` }
  }
  return { ok: false, output: `Could not find a field matching "${input.field}".` }
}

/** Click the first element whose text (button/link) matches the description. */
export async function browserClick(input: { element: string }): Promise<{ ok: boolean; output: string }> {
  if (!isBrowserOpen()) return { ok: false, output: 'No browser session open. Say "open <site>" first.' }
  if (!input.element.trim()) return { ok: false, output: 'Click needs an element description.' }
  const approved = await requestPermission({
    action: `Click "${input.element}" in the browser`,
    tier: 'confirm'
  })
  if (!approved) return { ok: false, output: 'Click declined.' }

  const q = JSON.stringify(input.element.toLowerCase())
  const res = await execInPage<boolean>(
    `(() => {
      const q = ${q};
      const cand = Array.from(document.querySelectorAll('button, a, [role=button], input[type=submit], input[type=button]'));
      const el = cand.find(e => e.textContent && e.textContent.toLowerCase().includes(q)) ||
                 cand.find(e => e.value && e.value.toLowerCase().includes(q));
      if (!el) return false;
      el.click();
      return true;
    })()`
  )
  if (res) {
    activity.log('browser', `Clicked "${input.element}"`)
    return { ok: true, output: `Clicked "${input.element}".` }
  }
  return { ok: false, output: `Could not find a clickable element matching "${input.element}".` }
}

export async function browserClose(): Promise<{ ok: boolean; output: string }> {
  if (browserWin && !browserWin.isDestroyed()) {
    browserWin.close()
    browserWin = null
    pushState()
    return { ok: true, output: 'Browser closed.' }
  }
  return { ok: false, output: 'No browser session open.' }
}

export function browserState(): BrowserState {
  return {
    open: isBrowserOpen(),
    url: activeUrl(),
    title: activeTitle(),
    tabs: browserTabs()
  }
}

/** Sync check — does a browser session currently have a loaded page? */
export function browserActive(): boolean {
  return isBrowserOpen() && activeUrl().length > 0
}

export function registerBrowserStates(): void {
  // no-op placeholder — pushState is invoked by navigation events above.
}