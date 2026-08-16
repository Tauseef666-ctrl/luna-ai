import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TtsSynthResult {
  pcm: Buffer
  sampleRate: number
}

let activeChild: ReturnType<typeof spawn> | null = null

export function findPiperExe(aiRoot: string): string | null {
  const candidates = [
    join(aiRoot, 'models', 'piper', 'bin', 'piper', 'piper.exe'),
    join(aiRoot, 'models', 'piper', 'bin', 'piper.exe'),
    join(aiRoot, 'models', 'piper', 'piper.exe')
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function voiceModelPath(aiRoot: string, voice: string): string {
  return join(aiRoot, 'models', 'piper', `${voice}.onnx`)
}

export function voiceSampleRate(aiRoot: string, voice: string): number {
  try {
    const raw = readFileSync(join(aiRoot, 'models', 'piper', `${voice}.onnx.json`), 'utf-8')
    const cfg = JSON.parse(raw) as { audio?: { sample_rate?: number } }
    return cfg.audio?.sample_rate ?? 22050
  } catch {
    return 22050
  }
}

export function stopSpeaking(): void {
  if (activeChild) {
    activeChild.kill()
    activeChild = null
  }
}

export function isSpeaking(): boolean {
  return activeChild !== null
}

export function synthesize(
  aiRoot: string,
  voice: string,
  text: string,
  opts: { lengthScale?: number } = {}
): Promise<TtsSynthResult> {
  return new Promise((resolve, reject) => {
    const exe = findPiperExe(aiRoot)
    if (!exe) {
      reject(
        new Error(
          'Piper engine not found. Place piper.exe (with espeak-ng-data) under models\\piper\\bin\\piper\\'
        )
      )
      return
    }
    const model = voiceModelPath(aiRoot, voice)
    if (!existsSync(model)) {
      reject(new Error(`Voice model not found: ${voice}.onnx (models\\piper\\)`))
      return
    }
    const args = ['--model', model, '--output_raw', '--sentence_silence', '0.12', '--quiet']
    const len = Number(opts.lengthScale ?? 1)
    if (len > 0 && len !== 1) args.push('--length_scale', String(len))
    const child = spawn(exe, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    activeChild = child

    const chunks: Buffer[] = []
    let errOut = ''
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d: Buffer) => {
      if (errOut.length < 8192) errOut += d.toString()
    })
    // If the child dies before stdin is flushed (e.g. missing espeak-ng-data),
    // the write can emit an unhandled 'error' on the stdin stream.
    child.stdin.on('error', () => {
      /* child already exited — nothing to do */
    })
    child.on('error', (e) => {
      if (activeChild === child) activeChild = null
      reject(e)
    })
    child.on('close', (code) => {
      if (activeChild === child) activeChild = null
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`Piper exited (${code}): ${errOut.slice(-300).trim()}`))
        return
      }
      resolve({ pcm: Buffer.concat(chunks), sampleRate: voiceSampleRate(aiRoot, voice) })
    })
    child.stdin.write(text, 'utf-8')
    child.stdin.end()
  })
}

export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const dataSize = pcm.length
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  pcm.copy(buf, 44)
  return buf
}
