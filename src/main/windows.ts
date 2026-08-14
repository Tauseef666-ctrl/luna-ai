import { BrowserWindow } from 'electron'
import { join } from 'node:path'

function isDev(): boolean {
  return Boolean(process.env.ELECTRON_RENDERER_URL)
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function createDashboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0A0A12',
    title: 'LUNA',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.removeMenu()
  win.once('ready-to-show', () => win.show())
  if (isDev()) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL as string)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

export function createFloatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 520,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: 'LUNA Float',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (isDev()) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/float.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/float.html'))
  }
  return win
}
