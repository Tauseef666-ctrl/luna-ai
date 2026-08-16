import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { loadConfig } from './config'
import { gatherCodingContext, contextBlock } from './coding-context'

const execFileAsync = promisify(execFile)

// execFile cannot run .cmd/.bat shims directly on Windows (EINVAL). Route them
// through cmd.exe /c, letting Node quote each argv element.
function runVscode(cmd: string, args: string[], opts: { timeout?: number } = {}): Promise<{ stdout: string }> {
  if (/\.(cmd|bat)$/i.test(cmd)) {
    return execFileAsync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd, ...args], {
      timeout: opts.timeout,
      windowsHide: true
    })
  }
  return execFileAsync(cmd, args, { timeout: opts.timeout, windowsHide: true })
}

export interface VscodeStatus {
  installed: boolean
  command: string
  version: string
}

async function vscodeCommand(): Promise<string> {
  const cfg = loadConfig()
  if (cfg.background && 'vscodePath' in cfg.background) {
    const custom = (cfg.background as { vscodePath?: string }).vscodePath
    if (custom && existsSync(custom)) return custom
  }
  for (const cmd of ['code', 'code.cmd', 'code.exe']) {
    try {
      const { stdout } = await runVscode(cmd, ['--version'], { timeout: 4000 })
      if (stdout.trim()) return cmd
    } catch {
      // try next
    }
  }
  const candidates = [
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\bin\\code.cmd` : '',
    process.env.ProgramFiles ? `${process.env.ProgramFiles}\\Microsoft VS Code\\bin\\code.cmd` : ''
  ].filter(Boolean)
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return 'code'
}

export async function vscodeStatus(): Promise<VscodeStatus> {
  try {
    const cmd = await vscodeCommand()
    const { stdout } = await runVscode(cmd, ['--version'], { timeout: 4000 })
    return { installed: true, command: cmd, version: stdout.trim().split(/\r?\n/)[0] ?? '' }
  } catch {
    return { installed: false, command: 'code', version: '' }
  }
}

// 'code' on PATH resolves to code.cmd (an npm-style shim) which spawn() cannot
// run directly (EINVAL). Route .cmd/.bat through cmd.exe /c.
function spawnCode(cmd: string, args: string[]): void {
  const child = /\.(cmd|bat)$/i.test(cmd)
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd, ...args], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })
    : spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false })
  child.on('error', () => {
    /* VS Code missing — vscodeStatus reports it */
  })
  child.unref()
}

export async function openInVSCode(path: string): Promise<boolean> {
  try {
    const cmd = await vscodeCommand()
    spawnCode(cmd, [path])
    return true
  } catch {
    return false
  }
}

export async function openFileInVSCode(filePath: string): Promise<boolean> {
  try {
    const cmd = await vscodeCommand()
    spawnCode(cmd, [filePath])
    return true
  } catch {
    return false
  }
}

export async function openTerminalInVSCode(dir: string): Promise<boolean> {
  try {
    const cmd = await vscodeCommand()
    spawnCode(cmd, [dir, '--terminal'])
    return true
  } catch {
    return false
  }
}

export async function vscodeContext(projectDir?: string): Promise<string> {
  const ctx = await gatherCodingContext(projectDir)
  return contextBlock(ctx)
}

export { gatherCodingContext, contextBlock } from './coding-context'
