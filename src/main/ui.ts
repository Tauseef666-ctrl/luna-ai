import { BrowserWindow } from 'electron'
import { createDashboardWindow, createFloatWindow } from './windows'

let dashboard: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null

export function openDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show()
    dashboard.focus()
    return
  }
  dashboard = createDashboardWindow()
  dashboard.on('closed', () => {
    dashboard = null
  })
}

export function toggleFloat(): void {
  if (floatWindow && !floatWindow.isDestroyed()) {
    if (floatWindow.isVisible()) floatWindow.hide()
    else {
      floatWindow.show()
      floatWindow.focus()
    }
    return
  }
  floatWindow = createFloatWindow()
  floatWindow.on('closed', () => {
    floatWindow = null
  })
}

export function closeFloat(): void {
  if (floatWindow && !floatWindow.isDestroyed()) floatWindow.close()
}

export function hideDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) dashboard.hide()
}

export function openFloat(): void {
  if (!floatWindow || floatWindow.isDestroyed()) toggleFloat()
  else if (!floatWindow.isVisible()) floatWindow.show()
}

export function setFloatAlwaysOnTop(flag: boolean): void {
  if (floatWindow && !floatWindow.isDestroyed()) floatWindow.setAlwaysOnTop(flag)
}

export function setFloatClickThrough(flag: boolean): void {
  if (floatWindow && !floatWindow.isDestroyed())
    floatWindow.setIgnoreMouseEvents(flag, { forward: true })
}

export function repositionFloat(x: number, y: number): void {
  if (floatWindow && !floatWindow.isDestroyed())
    floatWindow.setPosition(Math.round(x), Math.round(y))
}

export function resizeFloat(w: number, h: number): void {
  if (floatWindow && !floatWindow.isDestroyed())
    floatWindow.setSize(Math.max(220, Math.round(w)), Math.max(320, Math.round(h)))
}