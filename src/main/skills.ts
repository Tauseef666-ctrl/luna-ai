import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { loadConfig, saveConfig } from './config'
import { requestPermission } from './permission'
import { exitCodeCheck } from './verify'
import type { SkillInfo, SkillManifest, SkillRunResult } from '../shared/types'

const SKILL_TIMEOUT_MS = 120_000
const MAX_BUFFER = 10 * 1024 * 1024

export function skillDir(): string {
  return join(loadConfig().aiRoot, 'skills')
}

function readManifest(dir: string): SkillManifest | null {
  try {
    const raw = readFileSync(join(dir, 'manifest.json'), 'utf-8')
    const m = JSON.parse(raw) as Partial<SkillManifest>
    if (!m || typeof m.name !== 'string' || typeof m.command !== 'string' || !m.command.trim()) return null
    if (!Array.isArray(m.triggers)) m.triggers = []
    if (m.permissionTier !== 'confirm' && m.permissionTier !== 'safe') m.permissionTier = 'safe'
    if (m.action !== 'exec') m.action = 'exec'
    return m as SkillManifest
  } catch {
    return null
  }
}

export function listSkills(): SkillInfo[] {
  const root = skillDir()
  if (!existsSync(root)) return []
  const cfg = loadConfig()
  const skills: SkillInfo[] = []
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry)
    const manifestPath = join(dir, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    const m = readManifest(dir)
    if (!m) continue
    const enabled = cfg.skills.enabled[entry] !== false
    skills.push({
      id: entry,
      name: m.name,
      path: dir,
      description: m.description || '',
      triggers: m.triggers,
      permissionTier: m.permissionTier ?? 'safe',
      enabled,
      includeQuery: Boolean(m.includeQuery)
    })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export function setSkillEnabled(id: string, enabled: boolean): boolean {
  const cfg = loadConfig()
  if (enabled) delete cfg.skills.enabled[id]
  else cfg.skills.enabled[id] = false
  saveConfig(cfg)
  return true
}

export async function runSkill(id: string, query?: string): Promise<SkillRunResult> {
  const info = listSkills().find((s) => s.id === id)
  if (!info)
    return {
      ok: false,
      id,
      name: id,
      output: `Skill "${id}" not found.`,
      next: 'Check the folder name under D:\\own-ai\\skills\\ matches the skill id.'
    }
  if (!info.enabled)
    return { ok: false, id, name: info.name, output: `Skill "${info.name}" is disabled.`, next: 'Enable it in Settings → Automation & skills first.' }

  const cfg = loadConfig()
  const m = readManifest(info.path)
  if (!m)
    return {
      ok: false,
      id,
      name: info.name,
      output: `Skill "${info.name}" has an invalid manifest.json.`,
      next: 'Fix manifest.json (name + command are required), then retry.'
    }

  if (info.permissionTier === 'confirm' && cfg.automation.confirm) {
    const approved = await requestPermission({
      action: `skill:${id}`,
      tier: 'confirm',
      detail: `${info.name}: ${info.description || m.command}`
    })
    if (!approved)
      return { ok: false, id, name: info.name, output: `Skill "${info.name}" was not approved.`, next: 'Ask the user to approve the action, or run it as a safe-tier skill.' }
  }

  const args = [...(m.args ?? [])]
  if (m.includeQuery && query && query.trim()) args.push(query.trim())

  const cwd = m.cwd
    ? isAbsolute(m.cwd)
      ? m.cwd
      : join(cfg.aiRoot, m.cwd)
    : cfg.aiRoot

  // execFile cannot run .cmd/.bat directly on Windows (EINVAL) — route them
  // through cmd.exe /c, letting Node quote each argv element (repo pattern).
  const isBatch = /\.(cmd|bat)$/i.test(m.command)
  const file = isBatch ? process.env.ComSpec || 'cmd.exe' : m.command
  const fileArgs = isBatch ? ['/d', '/c', m.command, ...args] : args

  return new Promise<SkillRunResult>((resolve) => {
    const started = Date.now()
    execFile(
      file,
      fileArgs,
      { cwd, shell: false, windowsHide: true, timeout: SKILL_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        const duration = Date.now() - started
        if (err) {
          const timedOut = err.code === 'ETIMEDOUT' || err.killed
          const code = typeof err.code === 'number' ? err.code : null
          const check = exitCodeCheck(`${info.name} (skill)`, code, timedOut)
          return resolve({
            ok: false,
            id,
            name: info.name,
            output: stderr?.trim() || err.message || check.detail,
            error: err.message,
            next: check.next
          })
        }
        const out = [stdout, stderr].filter(Boolean).join('\n').trim()
        return resolve({
          ok: true,
          id,
          name: info.name,
          output: out || `Skill "${info.name}" completed (${duration}ms).`
        })
      }
    )
  })
}