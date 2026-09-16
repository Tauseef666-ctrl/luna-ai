import { clipboard } from 'electron'
import { activity } from './activity'
import { loadConfig } from './config'

/** Read-only clipboard access is opt-in via config. Never passively monitored. */
export function isClipboardEnabled(): boolean {
  return loadConfig().clipboard?.enabled ?? false
}

export function readClipboard(): string {
  if (!isClipboardEnabled()) return ''
  return clipboard.readText()
}

export function readClipboardSafe(): { ok: boolean; text: string; reason?: string } {
  if (!isClipboardEnabled())
    return {
      ok: false,
      text: '',
      reason: 'Clipboard access is off. Enable it in Settings → Automation → Clipboard access.'
    }
  const text = clipboard.readText().trim()
  if (!text) return { ok: false, text: '', reason: 'The clipboard is empty.' }
  activity.log('clipboard', `Clipboard read (${text.length} chars)`)
  return { ok: true, text }
}

export function writeClipboard(text: string): { ok: boolean; reason?: string } {
  if (!isClipboardEnabled())
    return {
      ok: false,
      reason: 'Clipboard access is off. Enable it in Settings → Automation → Clipboard access.'
    }
  if (!text.trim()) return { ok: false, reason: 'Nothing to copy.' }
  clipboard.writeText(text)
  activity.log('clipboard', `Clipboard written (${text.length} chars)`)
  return { ok: true }
}