import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'

export interface TrayHandlers {
  toggleFloat: () => void
  showDashboard: () => void
  quit: () => void
}

export function createTray(handlers: TrayHandlers): Tray {
  const iconPath = join(__dirname, '../../resources/tray.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    image = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAF0lEQVR42mNk+M9Qz0DAAKMYpRgq2AAAAABJRU5ErkJggg=='
    )
  }
  image = image.resize({ width: 16, height: 16 })

  const tray = new Tray(image)
  tray.setToolTip('LUNA — AI Companion')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Assistant', click: handlers.toggleFloat },
      { label: 'Open Dashboard', click: handlers.showDashboard },
      { type: 'separator' },
      { label: 'Pause Listening', enabled: false },
      { label: 'Quit', click: handlers.quit }
    ])
  )
  tray.on('double-click', handlers.toggleFloat)
  return tray
}

export function destroyTray(tray: Tray | null): void {
  if (tray && !tray.isDestroyed()) tray.destroy()
}
