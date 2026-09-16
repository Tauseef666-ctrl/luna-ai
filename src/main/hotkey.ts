import { BrowserWindow, globalShortcut } from 'electron'
import { loadConfig } from './config'
import { activity } from './activity'
import { openFloat } from './ui'

/**
 * §10 push-to-talk: register the configured global hotkey. When pressed, the
 * float window is shown (if not visible) and every renderer is told to begin
 * listening; the mic capture/STT pipeline lives in the renderer, so main only
 * forwards the trigger via 'hotkey:ptt'.
 */
let registered = ''
let attemptInFlight = false

export function registerHotkeys(): void {
  const cfg = loadConfig()
  const hotkey = (cfg.background?.hotkey || 'CommandOrControl+Shift+Space').trim()

  globalShortcut.unregisterAll()
  registered = ''

  if (!hotkey) {
    activity.log('hotkey', 'Hotkey disabled (empty accelerator)', 'warn')
    return
  }

  try {
    const handler = (): void => {
      openFloat()
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('hotkey:ptt')
      }
    }
    const ok = globalShortcut.register(hotkey, handler)
    registered = ok ? hotkey : ''
    activity.log(
      'hotkey',
      ok
        ? `Global hotkey registered: ${hotkey}`
        : `Could not register hotkey "${hotkey}" — another app may own it`,
      ok ? 'success' : 'warn'
    )
  } catch (err) {
    activity.log('hotkey', `Hotkey registration error: ${(err as Error).message}`, 'error')
  }
}

export function getRegisteredHotkey(): string {
  return registered
}

export function refreshHotkeys(): void {
  if (attemptInFlight) return
  attemptInFlight = true
  try {
    registerHotkeys()
  } finally {
    attemptInFlight = false
  }
}