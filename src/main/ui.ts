import { BrowserWindow } from 'electron'
import { createDashboardWindow } from './windows'
import { emitDigest } from './digest'

let dashboard: BrowserWindow | null = null

export function openDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show()
    dashboard.focus()
    emitDigest()
    return
  }
  dashboard = createDashboardWindow()
  dashboard.once('ready-to-show', () => {
    emitDigest()
  })
  dashboard.on('closed', () => {
    dashboard = null
  })
}

export function hideDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) dashboard.hide()
}
