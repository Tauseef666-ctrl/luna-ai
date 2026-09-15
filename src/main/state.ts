import { BrowserWindow } from 'electron'
import type { AppState } from '../shared/types'

const state: AppState = {
  char: 'idle',
  status: 'Ready to assist...',
  subtitle: '',
  luna: 'unknown',
  shoya: 'unknown',
  activeModel: ''
}

export function getState(): AppState {
  return state
}

export function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('luna:state', state)
  }
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch)
  broadcast()
}