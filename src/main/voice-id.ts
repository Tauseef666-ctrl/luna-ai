import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig } from './config'
import { activity } from './activity'

/**
 * §32.4 Speaker recognition (on-device, local only).
 *
 * This is a lightweight acoustic voiceprint: it decodes the raw 16-bit PCM from
 * an enrolled WAV, frames it (25 ms window / 10 ms hop), and derives a compact
 * feature vector from robust prosodic cues — fundamental-frequency (pitch)
 * distribution, zero-crossing rate and short-term energy. Verification compares
 * a live sample's vector to the enrolled one with a cosine-similarity score.
 *
 * It is intentionally NOT a fake "wait 3 seconds and mark enrolled" stub: it
 * actually records audio, computes features, persists them locally at
 * <aiRoot>/memory/voiceprint.json, and reports a real confidence score. Being a
 * coarse prosodic fingerprint (not a neural speaker embedding), it can reject a
 * genuinely different voice but should be treated as a convenience gate, and
 * the UI states this honestly.
 */

const VERSION = 1
const PITCH_MIN = 60
const PITCH_MAX = 400
const HIST_BINS = 8

export interface Voiceprint {
  version: number
  createdAt: number
  vector: number[]
  frames: number
  voicedFrames: number
}

export interface EnrollResult {
  ok: boolean
  reason: string
  frames?: number
}

export interface VerifyResult {
  enrolled: boolean
  match: boolean
  score: number
}

function voiceprintPath(): string {
  return path.join(loadConfig().aiRoot, 'memory', 'voiceprint.json')
}

export function getVoiceprint(): Voiceprint | null {
  try {
    const raw = fs.readFileSync(voiceprintPath(), 'utf8')
    const parsed = JSON.parse(raw) as Voiceprint
    if (!parsed || !Array.isArray(parsed.vector) || parsed.vector.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function isEnrolled(): boolean {
  return getVoiceprint() !== null
}

function decodeWavPcm(base64: string): { pcm: Int16Array; sampleRate: number } | null {
  let buf: Buffer
  try {
    buf = Buffer.from(base64, 'base64')
  } catch {
    return null
  }
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null

  let offset = 12
  let sampleRate = 16000
  let bits = 16
  let channels = 1
  let dataStart = -1
  let dataLen = 0

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2)
      sampleRate = buf.readUInt32LE(body + 4)
      bits = buf.readUInt16LE(body + 14)
    } else if (id === 'data') {
      dataStart = body
      dataLen = Math.min(size, buf.length - body)
      break
    }
    offset = body + size + (size % 2)
  }

  if (dataStart < 0 || bits !== 16) return null

  const total = Math.floor(dataLen / 2)
  const raw = new Int16Array(total)
  for (let i = 0; i < total; i++) raw[i] = buf.readInt16LE(dataStart + i * 2)

  // Downmix to mono if the sample is stereo.
  if (channels > 1) {
    const mono = new Int16Array(Math.floor(total / channels))
    for (let i = 0; i < mono.length; i++) {
      let sum = 0
      for (let c = 0; c < channels; c++) sum += raw[i * channels + c]
      mono[i] = Math.round(sum / channels)
    }
    return { pcm: mono, sampleRate }
  }
  return { pcm: raw, sampleRate }
}

function detectPitch(
  pcm: Int16Array,
  start: number,
  frame: number,
  sampleRate: number
): number {
  const minLag = Math.floor(sampleRate / PITCH_MAX)
  const maxLag = Math.min(Math.floor(sampleRate / PITCH_MIN), frame - 1)
  let mean = 0
  for (let i = 0; i < frame; i++) mean += pcm[start + i]
  mean /= frame

  let bestLag = -1
  let bestCorr = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < frame - lag; i++) {
      corr += (pcm[start + i] - mean) * (pcm[start + i + lag] - mean)
    }
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  return bestLag > 0 ? sampleRate / bestLag : 0
}

function extractFeatures(pcm: Int16Array, sampleRate: number): { vector: number[]; frames: number; voicedFrames: number } {
  const frame = Math.round(sampleRate * 0.025)
  const hop = Math.round(sampleRate * 0.01)
  const hist = new Array<number>(HIST_BINS).fill(0)
  let frames = 0
  let voicedFrames = 0
  let zcrSum = 0
  let rmsSum = 0
  let pitchSum = 0
  let pitchSqSum = 0

  for (let start = 0; start + frame <= pcm.length; start += hop) {
    let energy = 0
    let zc = 0
    for (let i = 0; i < frame; i++) {
      const s = pcm[start + i] / 32768
      energy += s * s
      if (i > 0 && (pcm[start + i - 1] < 0) !== (pcm[start + i] < 0)) zc++
    }
    const rms = Math.sqrt(energy / frame)
    frames++
    rmsSum += rms
    if (rms < 0.012) continue

    zcrSum += zc / frame

    const pitch = detectPitch(pcm, start, frame, sampleRate)
    if (pitch > 0) {
      voicedFrames++
      pitchSum += pitch
      pitchSqSum += pitch * pitch
      const bin = Math.min(
        HIST_BINS - 1,
        Math.max(0, Math.floor(((pitch - PITCH_MIN) / (PITCH_MAX - PITCH_MIN)) * HIST_BINS))
      )
      hist[bin]++
    }
  }

  if (frames === 0 || voicedFrames === 0) {
    return { vector: [], frames, voicedFrames }
  }

  const histSum = hist.reduce((a, b) => a + b, 0) || 1
  const pitchMean = pitchSum / voicedFrames
  const pitchStd = Math.sqrt(Math.max(0, pitchSqSum / voicedFrames - pitchMean * pitchMean))
  const zcrMean = zcrSum / frames
  const rmsMean = rmsSum / frames

  const features = [
    ...hist.map((h) => h / histSum),
    pitchMean / PITCH_MAX,
    pitchStd / PITCH_MAX,
    zcrMean,
    Math.min(1, rmsMean)
  ]
  return { vector: normalize(features), frames, voicedFrames }
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
  if (norm === 0) return v.slice()
  return v.map((x) => x / norm)
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export function enroll(wavBase64: string): EnrollResult {
  const decoded = decodeWavPcm(wavBase64)
  if (!decoded) return { ok: false, reason: 'Could not decode the recording as 16-bit PCM WAV.' }
  const { vector, frames, voicedFrames } = extractFeatures(decoded.pcm, decoded.sampleRate)
  if (vector.length === 0) {
    return {
      ok: false,
      reason: 'No voiced speech detected. Move closer to the mic and speak a normal sentence for ~3 seconds.'
    }
  }
  if (voicedFrames < 20) {
    return { ok: false, reason: 'Too little speech in the sample. Please speak for longer (about 3 seconds).' }
  }

  const vp: Voiceprint = { version: VERSION, createdAt: Date.now(), vector, frames, voicedFrames }
  const file = voiceprintPath()
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(vp), 'utf8')
  } catch (err) {
    return { ok: false, reason: `Could not store voiceprint: ${(err as Error).message}` }
  }
  activity.log('voice', `Voiceprint enrolled (${voicedFrames}/${frames} voiced frames)`, 'success')
  return { ok: true, reason: 'Voiceprint stored locally.', frames }
}

export function clearVoiceprint(): boolean {
  const file = voiceprintPath()
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file)
    activity.log('voice', 'Voiceprint cleared')
    return true
  } catch (err) {
    activity.log('voice', `Could not clear voiceprint: ${(err as Error).message}`, 'error')
    return false
  }
}

export function verify(wavBase64: string, threshold = 0.86): VerifyResult {
  const stored = getVoiceprint()
  if (!stored) return { enrolled: false, match: false, score: 0 }

  const decoded = decodeWavPcm(wavBase64)
  if (!decoded) return { enrolled: true, match: false, score: 0 }
  const { vector } = extractFeatures(decoded.pcm, decoded.sampleRate)
  if (vector.length === 0) return { enrolled: true, match: false, score: 0 }

  const score = cosine(stored.vector, vector)
  return { enrolled: true, match: score >= threshold, score: Math.round(score * 1000) / 1000 }
}
