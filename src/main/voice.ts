import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig } from './config'
import { activity } from './activity'
import { setState } from './state'
import { runChat } from './chat'
import { transcribeWav, whisperAvailable } from './stt'
import { findPiperExe, speakTo, stopTts, voiceSampleRate } from './tts'
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
          setState({ char: 'listening', status: 'Heard — thinking...', subtitle: result.text.slice(0, 160) })
          const reply = await runChat(event.sender, result.text)
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