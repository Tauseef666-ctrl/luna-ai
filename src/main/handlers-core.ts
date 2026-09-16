import { BrowserWindow, ipcMain } from 'electron'
import { loadConfig, saveConfig } from './config'
import { scanWorkspace } from './scanner'
import { safeBinary, safeImageDataUrl } from './assets'
import { createProject, deleteProject, listProjects, renameProject } from './projects'
import { memory, sessions } from './memory'
import { activity } from './activity'
import {
  closeFloat,
  openFloat,
  repositionFloat,
  resizeFloat,
  setFloatAlwaysOnTop,
  setFloatClickThrough,
  toggleFloat
} from './ui'
import { ensureCurrentSession, getCurrentSessionId, setCurrentSessionId } from './chat'
import { addRoutine, listRoutines, removeRoutine, toggleRoutine } from './routines'
import { addEvent, listEvents, listUpcoming, parseWhen, removeEvent, updateEvent } from './calendar'
import { isClipboardEnabled, readClipboard, writeClipboard } from './clipboard'
import {
  browserClose,
  browserExtract,
  browserOpen,
  browserState
} from './browser'
import type {
  ActivityEvent,
  LunaSession,
  MemoryEntry,
  MemoryTier,
  ProjectInfo
} from '../shared/types'

export function registerCoreHandlers(): void {
  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_e, c: Parameters<typeof saveConfig>[0]) => {
    saveConfig(c)
    activity.log('config', 'Settings updated')
  })
  ipcMain.handle('scan', () => {
    activity.log('scan', 'Workspace re-scanned')
    return scanWorkspace(loadConfig().aiRoot)
  })
  ipcMain.handle('assets:image', (_e, p: string) => safeImageDataUrl(loadConfig().aiRoot, p))
  ipcMain.handle('assets:binary', (_e, p: string) => safeBinary(loadConfig().aiRoot, p))
  ipcMain.handle('projects:list', (): ProjectInfo[] => listProjects(loadConfig().aiRoot))
  ipcMain.handle('projects:create', (_e, name: string): ProjectInfo | null => {
    const p = createProject(loadConfig().aiRoot, name)
    activity.log(
      'projects',
      p ? `Project created: ${p.name}` : `Failed to create project "${name}"`,
      p ? 'success' : 'error'
    )
    return p
  })
  ipcMain.handle('projects:rename', (_e, oldName: string, newName: string): boolean => {
    const ok = renameProject(loadConfig().aiRoot, oldName, newName)
    activity.log(
      'projects',
      ok ? `Project renamed: ${oldName} → ${newName}` : `Failed to rename project "${oldName}"`,
      ok ? 'success' : 'error'
    )
    return ok
  })
  ipcMain.handle('projects:delete', (_e, name: string): boolean => {
    const ok = deleteProject(loadConfig().aiRoot, name)
    activity.log(
      'projects',
      ok ? `Project deleted: ${name}` : `Failed to delete project "${name}"`,
      ok ? 'success' : 'error'
    )
    return ok
  })
  ipcMain.handle('activity:list', (_e, limit?: number): ActivityEvent[] => activity.list(limit))
  ipcMain.handle('activity:clear', (): number => {
    const n = activity.clear()
    activity.log('activity', `Activity log cleared (${n} events)`)
    return n
  })

  ipcMain.handle('routines:list', () => listRoutines())
  ipcMain.handle('routines:add', (_e, input: Parameters<typeof addRoutine>[0]) => addRoutine(input))
  ipcMain.handle('routines:remove', (_e, id: string) => removeRoutine(id))
  ipcMain.handle('routines:toggle', (_e, id: string, enabled: boolean) => toggleRoutine(id, enabled))

  ipcMain.handle('calendar:list', (_e, from?: number, to?: number) =>
    listEvents(Math.min(from ?? Date.now(), Date.now()), to)
  )
  ipcMain.handle('calendar:upcoming', (_e, limit?: number) => listUpcoming(limit))
  ipcMain.handle('calendar:add', (_e, input: Parameters<typeof addEvent>[0]) => addEvent(input))
  ipcMain.handle('calendar:update', (_e, id: string, patch: Parameters<typeof updateEvent>[1]) =>
    updateEvent(id, patch)
  )
  ipcMain.handle('calendar:remove', (_e, id: string) => removeEvent(id))
  ipcMain.handle('calendar:parseWhen', (_e, text: string) => parseWhen(text))

  ipcMain.handle('clipboard:enabled', () => isClipboardEnabled())
  ipcMain.handle('clipboard:read', () => readClipboard())
  ipcMain.handle('clipboard:write', (_e, text: string) => writeClipboard(text))

  ipcMain.handle('browser:state', () => browserState())
  ipcMain.handle('browser:open', (_e, url: string) => browserOpen({ url }))
  ipcMain.handle('browser:read', () => browserExtract())
  ipcMain.handle('browser:close', () => browserClose())

  ipcMain.handle('sessions:list', (): LunaSession[] => sessions.list())
  ipcMain.handle('sessions:current', (): LunaSession => ensureCurrentSession())
  ipcMain.handle('sessions:new', (_e, name?: string): LunaSession => {
    const s = sessions.create(name)
    setCurrentSessionId(s.id)
    activity.log('chat', 'New conversation started')
    return s
  })
  ipcMain.handle('sessions:save', (_e, id: string): boolean => {
    const ok = sessions.save(id)
    if (ok) activity.log('chat', 'Conversation saved')
    return ok
  })
  ipcMain.handle('sessions:unsave', (_e, id: string): boolean => {
    const ok = sessions.unsave(id)
    if (ok) activity.log('chat', 'Conversation unsaved (back to temp)')
    return ok
  })
  ipcMain.handle('sessions:remove', (_e, id: string): boolean => {
    const ok = sessions.remove(id)
    if (ok && getCurrentSessionId() === id) setCurrentSessionId('')
    if (ok) activity.log('chat', 'Conversation removed')
    return ok
  })
  ipcMain.handle('sessions:rename', (_e, id: string, name: string): boolean =>
    sessions.rename(id, name)
  )
  ipcMain.handle('sessions:prune', (): number => sessions.pruneExpired())

  ipcMain.handle('memory:list', (): MemoryEntry[] => memory.list())
  ipcMain.handle(
    'memory:add',
    (
      _e,
      input: { tier: MemoryTier; text: string; project?: string; tags?: string[]; saved?: boolean }
    ): MemoryEntry => {
      const e = memory.add(input)
      activity.log('memory', `Remembered (${e.tier}${e.project ? ` · ${e.project}` : ''})`)
      return e
    }
  )
  ipcMain.handle('memory:search', (_e, query: string): MemoryEntry[] => memory.search(query))
  ipcMain.handle('memory:delete', (_e, id: string): boolean => {
    const ok = memory.delete(id)
    if (ok) activity.log('memory', 'Memory entry deleted')
    return ok
  })
  ipcMain.handle('memory:pin', (_e, id: string, saved: boolean): boolean => memory.pin(id, saved))
  ipcMain.handle('memory:clear', (_e, tier?: MemoryTier): number => memory.clear(tier))
  ipcMain.handle('memory:export', (): string => memory.export())
  ipcMain.handle('memory:prune', (): number => memory.pruneExpired())

  ipcMain.handle('float:toggle', () => {
    toggleFloat()
    return true
  })
  ipcMain.handle('float:alwaysOnTop', (_e, flag: boolean) => {
    setFloatAlwaysOnTop(flag)
    return true
  })
  ipcMain.handle('float:close', () => {
    closeFloat()
    return true
  })
  ipcMain.handle('float:open', () => {
    openFloat()
    return true
  })
  ipcMain.handle('float:clickThrough', (_e, flag: boolean) => {
    setFloatClickThrough(flag)
    const c = loadConfig()
    saveConfig({ ...c, float: { ...c.float, clickThrough: flag } })
    return true
  })
  ipcMain.handle('float:reposition', (_e, x: number, y: number) => {
    repositionFloat(x, y)
    return true
  })
  ipcMain.handle('float:resize', (_e, w: number, h: number) => {
    resizeFloat(w, h)
    return true
  })

  ipcMain.on('hotkey:pressed', (_e, key: string) => {
    activity.log('hotkey', `Hotkey pressed: ${key}`)
  })
  ipcMain.on('character:set', (_e, p: { character: string; state: string }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('character:setState', p)
    }
  })
  ipcMain.on('ai:switch', (_e, p: { active: 'luna' | 'shoya' }) => {
    const c = loadConfig()
    saveConfig({ ...c, activeAi: p.active })
    activity.log('ai', `Active AI switched to ${p.active === 'luna' ? 'LUNA' : 'Shoya'}`)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('ai:switched', p)
    }
  })
}