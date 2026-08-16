import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const WHISPER_EXE_CANDIDATES = ['models/whisper/bin/whisper-cli.exe']
const WHISPER_MODEL_CANDIDATES = ['models/whisper/base/ggml-base.bin']

export interface SttResult {
  text: string
  language: string
}

function findWhisperExe(aiRoot: string): string | null {
  for (const rel of WHISPER_EXE_CANDIDATES) {
    const full = path.join(aiRoot, rel)
    if (existsSync(full)) return full
  }
  return null
}

function findWhisperModel(aiRoot: string): string | null {
  for (const rel of WHISPER_MODEL_CANDIDATES) {
    const full = path.join(aiRoot, rel)
    if (existsSync(full)) return full
  }
  return null
}

export function whisperAvailable(aiRoot: string): boolean {
  return !!findWhisperExe(aiRoot) && !!findWhisperModel(aiRoot)
}

export async function transcribeWav(
  aiRoot: string,
  wavPath: string,
  opts: { language?: string; timeoutMs?: number } = {}
): Promise<SttResult> {
  const exe = findWhisperExe(aiRoot)
  const model = findWhisperModel(aiRoot)
  if (!exe || !model) {
    return { text: '', language: opts.language ?? 'en' }
  }
  const lang =
    opts.language && opts.language !== 'hinglish' && opts.language !== 'auto'
      ? opts.language
      : 'auto'
  const outBase = path.join(os.tmpdir(), `luna-stt-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const args = ['-m', model, '-f', wavPath, '-l', lang, '-oj', '-of', outBase, '-np', '-nt']
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(exe, args, { windowsHide: true, timeout: opts.timeoutMs ?? 120000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    const raw = await fs.readFile(`${outBase}.json`, 'utf8')
    const data = JSON.parse(raw) as {
      result?: { language?: string }
      transcription?: Array<{ text?: string }>
    }
    const segments = data.transcription ?? (data as { result?: { transcription?: Array<{ text?: string }> } }).result?.transcription ?? []
    const text = segments
      .map((s) => s.text ?? '')
      .join(' ')
      .trim()
    return { text, language: data.result?.language ?? opts.language ?? 'en' }
  } finally {
    for (const suffix of ['.json', '.txt']) {
      try {
        await fs.unlink(`${outBase}${suffix}`)
      } catch {
        // temp file already gone
      }
    }
  }
}
