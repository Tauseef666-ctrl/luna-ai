import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ProviderConfig } from '../shared/types'
import { loadConfig } from './config'
import { providerChat } from './providers'
import { activity } from './activity'

const execFileAsync = promisify(execFile)

const NPM_OPENCODE_EXE = process.env.APPDATA
  ? join(process.env.APPDATA, 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe')
  : ''

const KNOWN_DIRS = [
  NPM_OPENCODE_EXE && join(NPM_OPENCODE_EXE, '..'),
  process.env.APPDATA ? join(process.env.APPDATA, 'npm') : '',
  process.env.ProgramFiles ? join(process.env.ProgramFiles, 'opencode') : '',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'opencode') : ''
].filter((p): p is string => Boolean(p))

function candidateCommands(): string[] {
  const cmds: string[] = []
  if (NPM_OPENCODE_EXE) cmds.push(NPM_OPENCODE_EXE)
  if (process.env.APPDATA) {
    cmds.push(join(process.env.APPDATA, 'npm', 'opencode.cmd'))
  }
  cmds.push('opencode', 'opencode.exe')
  return cmds
}

interface CliResult {
  stdout: string
  stderr: string
}

// execFile/spawn cannot execute .cmd/.bat shims directly on Windows (EINVAL).
// Route those through cmd.exe /c, letting Node quote each argv element.
function runCli(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number; maxBuffer?: number } = {}
): Promise<CliResult> {
  if (/\.(cmd|bat)$/i.test(cmd)) {
    return execFileAsync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd, ...args], {
      cwd: opts.cwd,
      timeout: opts.timeout,
      maxBuffer: opts.maxBuffer,
      windowsHide: true
    })
  }
  return execFileAsync(cmd, args, {
    cwd: opts.cwd,
    timeout: opts.timeout,
    maxBuffer: opts.maxBuffer,
    windowsHide: true
  })
}

function spawnCli(cmd: string, args: string[], opts: { cwd?: string; detached?: boolean } = {}): void {
  const child = /\.(cmd|bat)$/i.test(cmd)
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd, ...args], {
        cwd: opts.cwd,
        detached: opts.detached,
        stdio: 'ignore',
        windowsHide: false
      })
    : spawn(cmd, args, {
        cwd: opts.cwd,
        detached: opts.detached,
        stdio: 'ignore',
        windowsHide: false
      })
  child.on('error', () => {
    /* command missing — detection reports it */
  })
  child.unref()
}

export interface ShoyaDetection {
  found: boolean
  command: string
  version: string
  source: 'path' | 'npm' | 'known-dir' | 'vscode'
}

export interface ShoyaRunResult {
  ok: boolean
  backend: 'opencode' | 'provider'
  providerId: string
  output: string
  durationMs: number
  truncated: boolean
}

export interface ShoyaEnv {
  command: string
  cwd: string
}

export async function detectOpenCode(): Promise<ShoyaDetection> {
  const cmds = candidateCommands()
  for (const cmd of cmds) {
    try {
      const { stdout } = await runCli(cmd, ['--version'], { timeout: 5000 })
      const version = stdout.trim().split(/\s+/).pop() ?? ''
      if (version) {
        const source = cmd === NPM_OPENCODE_EXE ? 'npm' : 'path'
        return { found: true, command: cmd, version, source }
      }
    } catch {
      // try next candidate
    }
  }
  for (const dir of KNOWN_DIRS) {
    for (const name of ['opencode.exe', 'opencode.cmd']) {
      const full = join(dir, name)
      if (existsSync(full)) {
        try {
          const { stdout } = await runCli(full, ['--version'], { timeout: 5000 })
          const version = stdout.trim().split(/\s+/).pop() ?? ''
          if (version) return { found: true, command: full, version, source: 'known-dir' }
        } catch {
          // ignore broken install
        }
      }
    }
  }
  return { found: false, command: 'opencode', version: '', source: 'path' }
}

export async function openCodeEnv(projectDir?: string): Promise<ShoyaEnv> {
  const detection = await detectOpenCode()
  return {
    command: detection.command,
    cwd: projectDir && existsSync(projectDir) ? projectDir : process.cwd()
  }
}

function pickProvider(preferred?: { id?: string; kind?: string; model?: string }): ProviderConfig | null {
  const cfg = loadConfig()
  const all = Object.values(cfg.providers).filter(
    (p): p is ProviderConfig => Boolean(p) && p.enabled && p.kind !== 'ollama'
  )
  const sorted = all.sort((a, b) => a.priority - b.priority)
  if (preferred?.id) {
    const byId = sorted.find((p) => p.id === preferred.id)
    if (byId) {
      if (preferred.model) return { ...byId, model: preferred.model }
      return byId
    }
  }
  if (preferred?.kind) {
    const byKind = sorted.find((p) => p.kind === preferred.kind)
    if (byKind) {
      if (preferred.model) return { ...byKind, model: preferred.model }
      return byKind
    }
  }
  if (preferred?.model) {
    const top = sorted[0]
    if (top) return { ...top, model: preferred.model }
    return null
  }
  return sorted[0] ?? null
}

export interface ShoyaRunOptions {
  projectDir?: string
  maxOutputChars?: number
  providerId?: string
  providerKind?: string
  model?: string
}

export async function runShoya(
  prompt: string,
  opts: ShoyaRunOptions = {}
): Promise<ShoyaRunResult> {
  const started = Date.now()
  const maxChars = opts.maxOutputChars ?? 8000
  const cfg = loadConfig()

  const viaProvider = async (p: ProviderConfig): Promise<ShoyaRunResult> => {
    const reply = await providerChat(p, [{ role: 'user', content: prompt }], {
      temperature: cfg.chat.temperature,
      maxTokens: cfg.chat.maxTokens
    })
    return {
      ok: true,
      backend: 'provider',
      providerId: p.id,
      output: reply.slice(0, maxChars),
      durationMs: Date.now() - started,
      truncated: reply.length > maxChars
    }
  }

  const online = pickProvider({ id: opts.providerId, kind: opts.providerKind, model: opts.model })
  if (online) {
    try {
      const result = await viaProvider(online)
      activity.log('shoya', `Shoya online via provider ${online.id} (${online.model || 'auto'})`)
      return result
    } catch (err) {
      activity.log('shoya', `Provider ${online.id} failed: ${(err as Error).message}`, 'warn')
    }
  }

  const detection = await detectOpenCode()
  if (detection.found) {
    const env = await openCodeEnv(opts.projectDir)
    try {
      const args = ['run', '--print-logs']
      const model = opts.model || cfg.character.shoya.model || ''
      if (model) args.push('--model', model)
      args.push(prompt)
      const { stdout, stderr } = await runCli(env.command, args, {
        cwd: env.cwd,
        timeout: 600000,
        maxBuffer: 16 * 1024 * 1024
      })
      const output = (stdout || stderr || '').trim()
      return {
        ok: true,
        backend: 'opencode',
        providerId: 'opencode-cli',
        output: output.slice(0, maxChars),
        durationMs: Date.now() - started,
        truncated: output.length > maxChars
      }
    } catch (err) {
      const message = (err as Error).message
      if (!/ETIMEDOUT|killed|timed out/i.test(message)) {
        const fallback = pickProvider({ id: opts.providerId, kind: opts.providerKind, model: opts.model })
        if (fallback) {
          try {
            return await viaProvider(fallback)
          } catch {
            // fall through to error
          }
        }
      }
      return {
        ok: false,
        backend: 'opencode',
        providerId: 'opencode-cli',
        output: message.slice(0, maxChars),
        durationMs: Date.now() - started,
        truncated: message.length > maxChars
      }
    }
  }

  return {
    ok: false,
    backend: 'provider',
    providerId: '',
    output:
      'Shoya has no backend. Add an API provider in Settings → AI Models (Claude, Gemini, OpenAI-compatible) or install the OpenCode CLI (`npm i -g opencode-ai`).',
    durationMs: Date.now() - started,
    truncated: false
  }
}

export function launchShoyaTerminal(opts: { projectDir?: string } = {}): void {
  void (async () => {
    const env = await openCodeEnv(opts.projectDir)
    spawnCli(env.command, [], { cwd: env.cwd, detached: true })
  })()
}
