import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { ProjectInfo } from '../shared/types'

function safeName(name: string): string {
  const clean = name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
  return clean.slice(0, 64)
}

function projectsDir(aiRoot: string): string {
  return join(aiRoot, 'projects')
}

// Resolve a project name to a path that is strictly inside the projects
// folder. Rejects traversal names (.., .), absolute paths and anything that
// would escape the base directory. Returns null when unsafe.
function resolveProjectDir(aiRoot: string, name: string): string | null {
  if (!name || name === '.' || name === '..') return null
  const base = resolve(projectsDir(aiRoot))
  const full = resolve(join(base, name))
  if (full !== base && !full.startsWith(base + sep)) return null
  return full
}

export function listProjects(aiRoot: string): ProjectInfo[] {
  const dir = projectsDir(aiRoot)
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const p = join(dir, d.name)
        let createdAt = 0
        let updatedAt = 0
        try {
          const s = statSync(p)
          createdAt = s.birthtimeMs
          updatedAt = s.mtimeMs
        } catch {
          // keep zero timestamps
        }
        return { name: d.name, path: p, createdAt, updatedAt }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function createProject(aiRoot: string, name: string): ProjectInfo | null {
  const clean = safeName(name)
  if (!clean || clean === '.' || clean === '..') return null
  const dir = join(projectsDir(aiRoot), clean)
  try {
    if (existsSync(dir)) return null
    mkdirSync(dir, { recursive: true })
    return listProjects(aiRoot).find((p) => p.name === clean) ?? null
  } catch {
    return null
  }
}

export function renameProject(aiRoot: string, oldName: string, newName: string): boolean {
  const clean = safeName(newName)
  if (!clean || clean === '.' || clean === '..' || clean === oldName) return false
  const base = projectsDir(aiRoot)
  const from = resolveProjectDir(aiRoot, oldName)
  const to = resolveProjectDir(aiRoot, clean)
  if (!from || !to) return false
  if (!existsSync(from) || existsSync(to)) return false
  try {
    renameSync(from, to)
    return true
  } catch {
    return false
  }
}

export function deleteProject(aiRoot: string, name: string): boolean {
  const dir = resolveProjectDir(aiRoot, name)
  if (!dir || !existsSync(dir)) return false
  try {
    rmSync(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}
