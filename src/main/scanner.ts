import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative } from 'node:path'
import type { Asset, ScanResult } from '../shared/types'

const SKIP_DIRS = new Set(['node_modules', '.git', 'memory', 'config', 'projects'])

function walk(
  dir: string,
  depth: number,
  cb: (p: string, isDir: boolean, st: ReturnType<typeof statSync>) => void
): void {
  if (depth > 8) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      cb(full, true, st)
      walk(full, depth + 1, cb)
    } else {
      cb(full, false, st)
    }
  }
}

export function ensureWorkspace(root: string): void {
  const dirs = ['models', 'characters', 'animations', 'voices', 'projects', 'memory', 'config', 'reference']
  for (const d of dirs) {
    mkdirSync(join(root, d), { recursive: true })
  }
}

export function scanWorkspace(root: string): ScanResult {
  const result: ScanResult = {
    root,
    exists: existsSync(root),
    llm: [],
    embedding: [],
    stt: [],
    tts: [],
    wakeword: [],
    characters: [],
    animations: [],
    reference: [],
    projects: [],
    warnings: []
  }
  if (!result.exists) return result

  const modelsDir = join(root, 'models')

  // Ollama models (parse manifests, model name = parent folder, tag = file name)
  const ollamaManifests = join(modelsDir, 'ollama', 'manifests')
  if (existsSync(ollamaManifests)) {
    walk(ollamaManifests, 0, (p, isDir) => {
      if (isDir || basename(p).startsWith('sha256-')) return
      const parts = relative(ollamaManifests, p).split(/[\\/]/)
      if (parts.length >= 3) {
        const model = parts[parts.length - 2]
        const tag = basename(p)
        const name = `${model}:${tag}`
        const asset: Asset = { name, path: p, kind: 'ollama', size: 0 }
        if (name.includes('embed')) result.embedding.push(asset)
        else result.llm.push(asset)
      }
    })
  }

  // Whisper STT models
  const whisperDir = join(modelsDir, 'whisper')
  if (existsSync(whisperDir)) {
    walk(whisperDir, 0, (p, isDir) => {
      if (isDir || extname(p) !== '.bin') return
      const name = relative(whisperDir, p).split(/[\\/]/)[0]
      if (!result.stt.some((a) => a.name === name)) {
        result.stt.push({ name, path: p, kind: 'whisper', size: 0 })
      }
    })
  }

  // Piper TTS voices
  const piperDir = join(modelsDir, 'piper')
  if (existsSync(piperDir)) {
    walk(piperDir, 0, (p, isDir) => {
      if (isDir || !p.endsWith('.onnx.json')) return
      result.tts.push({ name: basename(p).replace('.onnx.json', ''), path: p, kind: 'piper', size: 0 })
    })
  }

  // Wake-word models
  const wakeDir = join(modelsDir, 'wakeword')
  if (existsSync(wakeDir)) {
    walk(wakeDir, 0, (p, isDir) => {
      if (isDir || extname(p) !== '.onnx') return
      result.wakeword.push({ name: basename(p), path: p, kind: 'wakeword', size: 0 })
    })
  }

  // Reference concept art (look reference only, never runtime assets)
  const refDir = join(root, 'reference')
  if (existsSync(refDir)) {
    walk(refDir, 0, (p, isDir) => {
      if (isDir) return
      const ext = extname(p).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        result.reference.push({ name: basename(p), path: p, kind: 'reference', size: 0 })
      }
    })
  }

  // 3D characters + animations anywhere else in the workspace
  walk(root, 0, (p, isDir) => {
    if (isDir) return
    const rel = relative(root, p).split(/[\\/]/)[0]
    if (SKIP_DIRS.has(rel) || rel === 'models' || rel === 'reference') return
    const ext = extname(p).toLowerCase()
    if (['.glb', '.gltf', '.fbx', '.vrm'].includes(ext)) {
      const isAnim = rel === 'animations'
      const asset: Asset = { name: basename(p), path: p, kind: isAnim ? 'animation' : 'character', size: 0 }
      if (isAnim) result.animations.push(asset)
      else result.characters.push(asset)
    }
  })

  // Projects
  const projectsDir = join(root, 'projects')
  if (existsSync(projectsDir)) {
    for (const e of readdirSync(projectsDir)) {
      const full = join(projectsDir, e)
      try {
        if (statSync(full).isDirectory()) {
          result.projects.push({ name: e, path: full, kind: 'project', size: 0 })
        }
      } catch {
        /* ignore */
      }
    }
  }

  return result
}
