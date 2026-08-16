const TARGET_SAMPLE_RATE = 16000

type LevelCallback = (v: number) => void

class VoiceCapture {
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private processor: ScriptProcessorNode | null = null
  private muteGain: GainNode | null = null
  private samples: Float32Array[] = []
  private totalSamples = 0
  private recording = false
  private raf = 0
  private levelCb: LevelCallback | null = null

  get isRecording(): boolean {
    return this.recording
  }

  onLevel(cb: LevelCallback): void {
    this.levelCb = cb
  }

  async start(): Promise<boolean> {
    if (this.recording) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      })
      this.stream = stream
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      this.audioCtx = ctx

      const source = ctx.createMediaStreamSource(stream)
      this.source = source

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      this.analyser = analyser

      const processor = ctx.createScriptProcessor(4096, 1, 1)
      const muteGain = ctx.createGain()
      muteGain.gain.value = 0
      source.connect(processor)
      processor.connect(muteGain)
      muteGain.connect(ctx.destination)
      this.processor = processor
      this.muteGain = muteGain

      const inputRate = ctx.sampleRate
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0)
        this.pushDownsampled(input, inputRate)
      }

      this.samples = []
      this.totalSamples = 0
      this.recording = true
      this.levelLoop()
      return true
    } catch {
      this.cleanup()
      return false
    }
  }

  private pushDownsampled(input: Float32Array, inRate: number): void {
    const ratio = inRate / TARGET_SAMPLE_RATE
    if (ratio <= 1) {
      this.samples.push(new Float32Array(input))
      this.totalSamples += input.length
      return
    }
    const out = new Float32Array(Math.floor(input.length / ratio))
    for (let i = 0; i < out.length; i++) {
      out[i] = input[Math.floor(i * ratio)]
    }
    this.samples.push(out)
    this.totalSamples += out.length
  }

  private levelLoop(): void {
    if (!this.recording || !this.analyser) return
    const buf = new Uint8Array(this.analyser.fftSize)
    this.analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    this.levelCb?.(Math.min(1, Math.sqrt(sum / buf.length) * 3))
    this.raf = requestAnimationFrame(() => this.levelLoop())
  }

  async stop(): Promise<string | null> {
    if (!this.recording) return null
    this.recording = false
    cancelAnimationFrame(this.raf)
    const chunks = this.samples
    const total = this.totalSamples
    this.cleanup()
    if (total === 0) return null
    const pcm = new Int16Array(total)
    let offset = 0
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]))
        pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
    }
    return wavToBase64(pcm, TARGET_SAMPLE_RATE)
  }

  abort(): void {
    this.recording = false
    cancelAnimationFrame(this.raf)
    this.cleanup()
  }

  private cleanup(): void {
    for (const node of [this.processor, this.muteGain, this.source, this.analyser]) {
      try {
        node?.disconnect()
      } catch {
        // node already disconnected
      }
    }
    this.processor = null
    this.muteGain = null
    this.source = null
    this.analyser = null
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => undefined)
    }
    this.audioCtx = null
    this.samples = []
    this.totalSamples = 0
  }
}

function wavToBase64(pcm: Int16Array, sampleRate: number): string {
  const dataSize = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  new Int16Array(buffer, 44).set(pcm)
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

export const voiceCapture = new VoiceCapture()
