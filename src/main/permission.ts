import { BrowserWindow, ipcMain } from 'electron'
import { activity } from './activity'

export interface PermissionRequest {
  action: string
  tier: 'safe' | 'confirm'
  detail?: string
}

type Resolver = (approved: boolean) => void

const pending = new Map<string, Resolver>()

/**
 * Ask the user to approve or deny an action. Resolves once the user responds
 * from any window's permission dialog (`permission:request` → `permission:response`).
 */
export function requestPermission(request: PermissionRequest): Promise<boolean> {
  return new Promise((resolve) => {
    pending.set(request.action, resolve)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('permission:request', request)
    }
  })
}

export function registerPermissionHandler(): void {
  ipcMain.on('permission:response', (_event, p: { action: string; approved: boolean }) => {
    if (p && typeof p.action === 'string') {
      const resolve = pending.get(p.action)
      if (resolve) {
        pending.delete(p.action)
        resolve(Boolean(p.approved))
      }
    }
    activity.log(
      'permission',
      `${p.approved ? 'Approved' : 'Denied'}: ${p.action}`,
      p.approved ? 'success' : 'warn'
    )
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('permission:resolved', p)
    }
  })
}