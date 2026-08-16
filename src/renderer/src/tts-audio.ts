let ctx: AudioContext | null = null
let source: AudioBufferSourceNode | null = null
let analyser: AnalyserNode | null = null
let raf = 0
let onEnd: (() => void) | null = null

function levelFromAnalyser(): number {
  if (!analyser) return 0
  const buf = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * 3)
}

function loop(cb: (v: number) => void): void {
  cb(levelFromAnalyser())
  raf = requestAnimationFrame(() => loop(cb))
}

export function playWavBase64(
  wavBase64: string,
  sampleRate: number,
  onLevel: (v: number) => void,
  onEnded: () => void
): void {
  stopAudio()
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 22050
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: rate })
  } else if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  const arrayBuffer = base64ToArrayBuffer(wavBase64)
  void ctx
    .decodeAudioData(arrayBuffer)
    .then((buffer) => {
      if (!ctx) return
      analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.55
      source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(analyser)
      analyser.connect(ctx.destination)
      onEnd = onEnded
      source.onended = () => {
        cancelAnimationFrame(raf)
        raf = 0
        source = null
        analyser = null
        onEnd?.()
        onEnd = null
      }
      source.start()
      loop(onLevel)
    })
    .catch(() => {
      onEnded()
    })
}

export function stopAudio(): void {
  cancelAnimationFrame(raf)
  raf = 0
  if (source) {
    try {
      source.onended = null
      source.stop()
    } catch {
      /* already stopped */
    }
    source.disconnect()
    source = null
  }
  if (analyser) {
    analyser.disconnect()
    analyser = null
  }
  onEnd = null
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}
