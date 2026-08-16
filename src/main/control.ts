import { dialog, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { loadConfig } from './config'
import { activity } from './activity'
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

export function launchApp(command: string): boolean {
  if (!command.trim()) return false
  const child = spawn(command, { shell: true, detached: true, stdio: 'ignore' })
  child.on('error', () => {
    /* command not found / failed to spawn — caller reports the failure */
  })
  child.unref()
  return true
}

export function openUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  void shell.openExternal(url)
  return true
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

export async function runCommand(command: string): Promise<CommandResult> {
  const cmd = command.trim()
  if (!cmd) return { ok: false, confirmed: true, output: 'Empty command.' }
  const lower = cmd.toLowerCase()
  const isSafe =
    SAFE_COMMANDS.some((p) => lower.startsWith(p)) && !CHAIN_CHARS.some((c) => cmd.includes(c))
  const cfg = loadConfig()
  let confirmed = isSafe
  if (!isSafe && cfg.automation?.confirm !== false) {
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
    confirmed = response === 0
  }
  if (!confirmed) {
    activity.log('automation', `Command blocked: ${cmd.slice(0, 80)}`, 'warn')
    return { ok: false, confirmed: false, output: 'Blocked — you cancelled the confirmation.' }
  }
  try {
    const out = await runPs(cmd)
    activity.log('automation', `Ran command: ${cmd.slice(0, 80)}`)
    return { ok: true, confirmed: true, output: out }
  } catch (err) {
    activity.log('automation', `Command failed: ${cmd.slice(0, 80)}`, 'error')
    return { ok: false, confirmed: true, output: (err as Error).message }
  }
}
