import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { loadConfig } from './config'

const execFileAsync = promisify(execFile)

export interface GitStatusLine {
  status: string
  file: string
}

export interface CodingContext {
  project: string
  path: string
  exists: boolean
  git: {
    isRepo: boolean
    branch: string
    changes: GitStatusLine[]
  } | null
  tree: string[]
  summary: {
    sourceFiles: number
    totalLines: number
    latestChanged: string[]
  }
}

const CODE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.c', '.cpp', '.h',
  '.hpp', '.cs', '.kt', '.php', '.go', '.rs', '.rb', '.sql', '.html', '.css', '.scss',
  '.json', '.yaml', '.yml', '.toml', '.md', '.sh', '.ps1', '.bat'
])

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build', '.next', '.nuxt', 'venv', '.venv', '__pycache__'])

export async function gitStatus(projectDir: string): Promise<CodingContext['git']> {
  if (!existsSync(join(projectDir, '.git'))) return null
  try {
    const branch = (await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectDir, windowsHide: true })).stdout.trim()
    const out = (await execFileAsync('git', ['status', '--porcelain'], { cwd: projectDir, windowsHide: true })).stdout
    const changes = out
      .split('\n')
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2).trim(), file: line.slice(3) }))
      .slice(0, 50)
    return { isRepo: true, branch, changes }
  } catch {
    return { isRepo: true, branch: 'unknown', changes: [] }
  }
}

function walkTree(base: string, dir: string, depth: number, acc: string[]): void {
  if (depth > 3) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) walkTree(base, full, depth + 1, acc)
    else {
      const ext = name.slice(name.lastIndexOf('.'))
      if (CODE_EXT.has(ext)) acc.push(relative(base, full))
    }
  }
}

export async function gatherCodingContext(projectDir?: string): Promise<CodingContext> {
  const cfg = loadConfig()
  const dir = projectDir || cfg.activeProject || process.cwd()
  const exists = existsSync(dir)

  if (!exists) {
    return {
      project: dir,
      path: dir,
      exists: false,
      git: null,
      tree: [],
      summary: { sourceFiles: 0, totalLines: 0, latestChanged: [] }
    }
  }

  const git = await gitStatus(dir)
  const tree: string[] = []
  walkTree(dir, dir, 0, tree)
  const sorted = [...tree].sort((a, b) => a.length - b.length)

  let totalLines = 0
  const byMtime: Array<{ f: string; mtime: number }> = []
  for (const f of sorted.slice(0, 80)) {
    try {
      const full = join(dir, f)
      const st = statSync(full)
      if (st.size > 2 * 1024 * 1024) continue
      const content = readFileSync(full, 'utf8')
      totalLines += content.split('\n').length
      byMtime.push({ f, mtime: st.mtimeMs })
    } catch {
      // skip unreadable files
    }
  }

  for (const f of sorted.slice(80)) {
    try {
      byMtime.push({ f, mtime: statSync(join(dir, f)).mtimeMs })
    } catch {
      // skip unreadable files
    }
  }
  byMtime.sort((a, b) => b.mtime - a.mtime)
  const latestChanged = byMtime.slice(0, 5).map((x) => x.f)

  return {
    project: dir.split(/[\\/]/).pop() ?? dir,
    path: dir,
    exists: true,
    git,
    tree: sorted.slice(0, 40),
    summary: {
      sourceFiles: sorted.length,
      totalLines,
      latestChanged
    }
  }
}

export function contextBlock(ctx: CodingContext): string {
  if (!ctx.exists) return `Project "${ctx.project}" does not exist at ${ctx.path}.`
  const parts: string[] = []
  parts.push(`Project: ${ctx.project}`)
  parts.push(`Path: ${ctx.path}`)
  if (ctx.git) {
    parts.push(`Git: repo on branch "${ctx.git.branch}" with ${ctx.git.changes.length} changed files`)
    if (ctx.git.changes.length > 0) {
      parts.push(
        'Changed files:\n' + ctx.git.changes.map((c) => `- [${c.status}] ${c.file}`).slice(0, 20).join('\n')
      )
    }
  } else {
    parts.push('Git: not a git repository')
  }
  parts.push(`Source files: ${ctx.summary.sourceFiles}, approx ${ctx.summary.totalLines} lines`)
  if (ctx.summary.latestChanged.length > 0) {
    parts.push('Key files:\n' + ctx.summary.latestChanged.join('\n'))
  }
  return parts.join('\n')
}
