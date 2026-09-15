import { existsSync } from 'node:fs'
import type { ChildProcess } from 'node:child_process'

export interface Verification {
  ok: boolean
  detail: string
  next?: string
}

export function fileExists(path: string): Verification {
  const ok = Boolean(path) && existsSync(path)
  return {
    ok,
    detail: ok ? `Verified on disk: ${path}` : `Not found on disk: ${path}`,
    next: ok ? undefined : 'Check that the path exists, then retry or ask the user for the correct location.'
  }
}

export function exitCodeCheck(label: string, code: number | null, timedOut = false): Verification {
  if (timedOut)
    return { ok: false, detail: `${label} timed out`, next: 'Retry, or try a shorter/shared version of the task.' }
  if (code === 0) return { ok: true, detail: `${label} completed (exit code 0)` }
  return {
    ok: false,
    detail: `${label} failed (exit code ${code})`,
    next: `Review "${label}" output for the failing step, then retry or ask the user how to proceed.`
  }
}

export function spawnVerified(label: string, child: ChildProcess, graceMs = 1500): Promise<Verification> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: Verification): void => {
      if (done) return
      done = true
      resolve(v)
    }
    child.on('error', (err) => {
      finish({
        ok: false,
        detail: `${label} failed to start: ${err.message}`,
        next: `Check that "${label}" is installed, then retry or ask the user for the correct app.`
      })
    })
    child.on('exit', (code) => finish(exitCodeCheck(label, code)))
    setTimeout(() => finish({ ok: true, detail: `${label} started (still running after ${graceMs}ms).` }), graceMs)
  })
}