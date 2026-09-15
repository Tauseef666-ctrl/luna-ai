import { BrowserWindow, dialog, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { loadConfig } from './config'
import { activity } from './activity'
import { requestPermission } from './permission'
import { spawnVerified } from './verify'
import type { CommandResult, WindowInfo } from '../shared/types'

const execFileP = promisify(execFile)

function runPs(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return execFileP(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 30000 }
  ).then((r) => r.stdout || '')
}

export async function listWindows(): Promise<WindowInfo[]> {
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Get-Process | Where-Object { $_.MainWindowTitle } |',
    '  Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress'
  ].join('\n')
  try {
    const out = await runPs(script)
    if (!out.trim()) return []
    const data = JSON.parse(out) as Array<{ Id: number; ProcessName: string; MainWindowTitle: string }>
    const arr = Array.isArray(data) ? data : [data]
    return arr.map((w) => ({ pid: w.Id, app: w.ProcessName, title: w.MainWindowTitle }))
  } catch {
    return []
  }
}

export async function focusWindow(pid: number): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 0) return false
  const script = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class WinFocus {',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
    '}',
    '"@',
    `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    'if (-not $p) { exit 1 }',
    '[WinFocus]::ShowWindow($p.MainWindowHandle, 9) | Out-Null',
    '[WinFocus]::SetForegroundWindow($p.MainWindowHandle) | Out-Null'
  ].join('\n')
  try {
    await runPs(script)
    return true
  } catch {
    return false
  }
}

export async function screenshot(): Promise<string> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen',
    '$bmp = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.CopyFromScreen($vs.Left, $vs.Top, 0, 0, $bmp.Size)',
    '$mem = New-Object System.IO.MemoryStream',
    '$bmp.Save($mem, [System.Drawing.Imaging.ImageFormat]::Png)',
    '[Convert]::ToBase64String($mem.ToArray())'
  ].join('\n')
  const b64 = await runPs(script)
  return `data:image/png;base64,${b64}`
}

export async function launchApp(command: string): Promise<CommandResult> {
  const cmd = command.trim()
  if (!cmd)
    return {
      ok: false,
      confirmed: true,
      output: 'Empty app name.',
      next: 'Say which app to open, e.g. "open calculator".'
    }
  const child = spawn(cmd, { shell: true, detached: true, stdio: 'ignore' })
  child.unref()
  const v = await spawnVerified(cmd, child, 1500)
  activity.log('automation', v.detail)
  if (!v.ok) activity.log('automation', cmd.slice(0, 80) + ' — ' + v.detail + (v.next ? ' Next: ' + v.next : ''), 'warn')
  return {
    ok: v.ok,
    confirmed: true,
    output: v.ok ? `Launched "${cmd}"` : `Failed to launch "${cmd}" — ${v.detail}`,
    next: v.ok ? undefined : v.next
  }
}

export async function openUrl(url: string): Promise<CommandResult> {
  if (!/^https?:\/\//i.test(url)) {
    activity.log('automation', `Refused unsafe URL: ${url}`, 'warn')
    return {
      ok: false,
      confirmed: true,
      output: `Refused unsafe URL: ${url}`,
      next: 'Only http/https URLs are opened.'
    }
  }
  try {
    await shell.openExternal(url)
    return { ok: true, confirmed: true, output: `Opened ${url}` }
  } catch (err) {
    activity.log('automation', `Failed to open ${url}: ${(err as Error).message}`, 'error')
    return {
      ok: false,
      confirmed: true,
      output: `Failed to open ${url}: ${(err as Error).message}`,
      next: 'Retry, or copy the URL into your browser manually.'
    }
  }
}

export async function openPath(path: string): Promise<boolean> {
  const err = await shell.openPath(path)
  return err === ''
}

export function openInVSCode(path: string): void {
  const child = spawn('code', [path], { detached: true, stdio: 'ignore' })
  child.on('error', () => {
    /* VS Code not installed */
  })
  child.unref()
}

const SAFE_COMMANDS = [
  'echo ',
  'dir ',
  'ls ',
  'cd ',
  'type ',
  'tasklist',
  'systeminfo',
  'whoami',
  'ver ',
  'ipconfig',
  'hostname',
  'netstat ',
  'cls',
  'help',
  'pwd',
  'get-date',
  'get-location',
  'get-process',
  'ping '
]

// A "safe" prefix is only trustworthy if the command does not chain more
// commands onto it (e.g. `whoami; Remove-Item ...` or `type x && del y`).
const CHAIN_CHARS = ['&&', '||', ';', '|', '>', '<']

async function confirmCommand(cmd: string): Promise<boolean> {
  const hasWindow = BrowserWindow.getAllWindows().some((w) => !w.isDestroyed())
  if (hasWindow) {
    return requestPermission({
      action: `Run command: ${cmd.slice(0, 60)}`,
      tier: 'confirm',
      detail: `Runs in your Windows session with your permissions.\n\n${cmd}`
    })
  }
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Allow once', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'LUNA — run command?',
    message: `Run "${cmd}"?`,
    detail:
      'This command is not on the safe list. It will run in your Windows session with your permissions.'
  })
  return response === 0
}

export async function runCommand(command: string): Promise<CommandResult> {
  const cmd = command.trim()
  if (!cmd) return { ok: false, confirmed: true, output: 'Empty command.' }
  const lower = cmd.toLowerCase()
  const isSafe =
    SAFE_COMMANDS.some((p) => lower.startsWith(p)) && !CHAIN_CHARS.some((c) => cmd.includes(c))
  const cfg = loadConfig()
  let confirmed = isSafe
  if (!isSafe && cfg.automation?.confirm !== false) {
    confirmed = await confirmCommand(cmd)
  }
  if (!confirmed) {
    activity.log('automation', `Command blocked: ${cmd.slice(0, 80)}`, 'warn')
    return {
      ok: false,
      confirmed: false,
      output: 'Blocked — you cancelled the confirmation.',
      next: 'Re-run to allow this command once, or turn off confirmations in Settings → Automation.'
    }
  }
  try {
    const out = await runPs(cmd)
    activity.log('automation', `Ran command: ${cmd.slice(0, 80)}`)
    return { ok: true, confirmed: true, output: out }
  } catch (err) {
    activity.log('automation', `Command failed: ${cmd.slice(0, 80)}`, 'error')
    return {
      ok: false,
      confirmed: true,
      output: (err as Error).message,
      next: 'Check the error output for the failing step, then retry or ask the user how to proceed.'
    }
  }
}
