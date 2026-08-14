import { existsSync, readFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

function isInside(root: string, target: string): boolean {
  const r = resolve(root)
  const t = resolve(target)
  return t === r || t.startsWith(r + sep)
}

export function safeImageDataUrl(aiRoot: string, relPath: string): string {
  const refDir = join(aiRoot, 'reference')
  const full = resolve(aiRoot, relPath)
  if (!isInside(refDir, full) || !existsSync(full)) return ''
  const ext = extname(full).toLowerCase()
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(full).toString('base64')}`
}

const MODEL_DIRS = new Set(['characters', 'animations', 'models'])

export function safeBinary(aiRoot: string, relPath: string): Uint8Array | null {
  const full = resolve(aiRoot, relPath)
  if (!isInside(aiRoot, full) || !existsSync(full)) return null
  const rel = resolve(aiRoot).length === full.length ? '' : full.slice(resolve(aiRoot).length + 1)
  const first = rel.split(sep)[0] ?? ''
  if (!MODEL_DIRS.has(first)) return null
  return new Uint8Array(readFileSync(full))
}
