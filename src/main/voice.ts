import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig, saveConfig } from './config'
import { activity } from './activity'
import { setState } from './state'
import { runTaskOrChat } from './chat'
import { transcribeWav, whisperAvailable } from './stt'
import { findPiperExe, speakTo, stopTts, voiceSampleRate } from './tts'
import { clearVoiceprint, enroll, isEnrolled, verify } from './voice-id'
import type { TtsStatus } from '../shared/types'

export function registerVoiceHandlers(): void {
  ipcMain.on('voice:input', (_e, p: { text: string; language: string }) => {
    activity.log('voice', `Voice input (${p.language}): ${p.text.slice(0, 120)}`)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('voice:heard', p)
    }
  })

  ipcMain.on(
    'voice:audio',
    async (event, p: { wavBase64: string; sampleRate: number; language?: string }) => {
      const c = loadConfig()
      if (!p || typeof p.wavBase64 !== 'string' || !p.wavBase64) return
      if (!whisperAvailable(c.aiRoot)) {
        activity.log('voice', 'STT unavailable — whisper-cli or model not found', 'warn')
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('voice:heard', { text: '', language: '' })
        }
        return
      }
      const tmpPath = path.join(
        app.getPath('temp'),
        `luna-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
      )
      try {
        await fs.promises.writeFile(tmpPath, Buffer.from(p.wavBase64, 'base64'))
        const hint = p.language || c.voice.language
        const result = await transcribeWav(c.aiRoot, tmpPath, { language: hint })
        const heard = { text: result.text, language: result.language }
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('voice:heard', heard)
        }
        if (result.text.trim()) {
          activity.log('voice', `Heard (${result.language}): ${result.text.slice(0, 120)}`)

          // §32.4 speaker recognition: when enabled, only run the request for the
          // enrolled speaker. Unrecognized voices are met with an honest notice
          // (guest notice if guest mode is on) and no automation is executed.
          if (c.voiceId.enabled && isEnrolled()) {
            const check = verify(p.wavBase64)
            activity.log(
              'voice',
              `Speaker check: ${check.match ? 'match' : 'no match'} (score ${check.score})`,
              check.match ? 'success' : 'warn'
            )
            if (!check.match) {
              const notice = c.voiceId.guest
                ? "I don't recognize that voice, so I'm staying in guest mode — I can chat, but I won't run automations or touch your files, memory, or calendar."
                : "I don't recognize that voice, so I won't act on that request. Re-enroll your voice or ask the owner to disable voice ID."
              for (const win of BrowserWindow.getAllWindows()) {
                if (!win.isDestroyed()) win.webContents.send('chat:token', notice)
              }
              setState({ char: 'idle', status: 'Voice not recognized', subtitle: notice.slice(0, 160) })
              speakTo(event.sender, notice, c.character.luna.speaking)
              return
            }
            setState({ char: 'listening', status: 'Heard — thinking...', subtitle: result.text.slice(0, 160) })
            const reply = await runTaskOrChat(event.sender, result.text)
            setState({ char: 'idle', status: 'Ready to assist...', subtitle: reply.slice(0, 160) })
            return
          }

          setState({ char: 'listening', status: 'Heard — thinking...', subtitle: result.text.slice(0, 160) })
          const reply = await runTaskOrChat(event.sender, result.text)
          setState({ char: 'idle', status: 'Ready to assist...', subtitle: reply.slice(0, 160) })
        } else {
          activity.log('voice', 'Voice heard — nothing transcribed')
        }
      } catch (err) {
        activity.log('voice', `STT error: ${(err as Error).message}`, 'error')
      } finally {
        try {
          await fs.promises.unlink(tmpPath)
        } catch {
          // temp file already gone
        }
      }
    }
  )

  ipcMain.handle('voiceId:status', () => {
    const c = loadConfig()
    return { enabled: !!c.voiceId.enabled, guest: !!c.voiceId.guest, enrolled: isEnrolled() }
  })
  ipcMain.handle('voiceId:enroll', (_e, wavBase64: string) => {
    const r = enroll(wavBase64)
    if (r.ok) {
      const c = loadConfig()
      saveConfig({ ...c, voiceId: { ...c.voiceId, enabled: true } })
    }
    return r
  })
  ipcMain.handle('voiceId:verify', (_e, wavBase64: string) => verify(wavBase64))
  ipcMain.handle('voiceId:clear', () => {
    const ok = clearVoiceprint()
    if (ok) {
      const c = loadConfig()
      saveConfig({ ...c, voiceId: { ...c.voiceId, enabled: false } })
    }
    return ok
  })

  ipcMain.handle('tts:status', (): TtsStatus => {
    const c = loadConfig()
    const available = !!findPiperExe(c.aiRoot)
    return {
      available,
      engine: available ? 'piper' : 'none',
      voice: c.character.luna.speaking,
      sampleRate: voiceSampleRate(c.aiRoot, c.character.luna.speaking || 'en_US-amy-medium'),
      settings: { ...c.tts }
    }
  })
  ipcMain.handle('tts:speak', (event, text: string, voice?: string) => {
    const c = loadConfig()
    speakTo(event.sender, text, voice || c.character.luna.speaking)
  })
  ipcMain.handle('tts:stop', () => {
    stopTts()
    return true
  })
  ipcMain.handle('tts:done', () => {
    setState({ char: 'idle', status: 'Ready to assist...' })
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('tts:ended')
    }
    return true
  })
  ipcMain.on('tts:level', (_e, level: number) => {
    const v = Math.max(0, Math.min(1, level))
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('tts:level', v)
    }
  })
}