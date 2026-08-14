# LUNA — Advanced Windows AI Companion

LUNA is a Windows desktop AI companion built as a real application: offline-first local AI, an online coding companion (**Shoya**), 3D animated characters, voice interaction, memory, Windows control, project management, research and a futuristic glassy dashboard.

Full requirements live in [`LUNA_spec.md`](LUNA_spec.md). The build roadmap and progress tracker is [`plan.md`](plan.md).

## Stack

- **Electron** — native Windows desktop shell (tray, notifications, credential access)
- **Babylon.js** — 3D character rendering (placeholder rig for now, spec §32.1)
- **TypeScript** + electron-vite
- **Ollama** — local LLM inference via its REST API (`http://localhost:11434`, spec §32.2)
- **faster-whisper / Piper / wake-word** ONNX models — voice pipeline (spec §32.3)
- **electron-builder + GitHub Actions** — Windows installer release pipeline

## Status (v0.1.0 — first build)

Shipped in this first version:

- [x] Fresh Electron + Babylon.js + TypeScript scaffold (old Tauri/Python build fully removed)
- [x] Dark glassy dashboard shell with the design system palette from spec §2.4
- [x] Placeholder 3D character rig (idle / listening / thinking / speaking / working states, breathing + lip-jaw sync, status ring) — spec §32.1 fallback
- [x] Floating half-body window (always-on-top, pin/close, status + subtitle bar)
- [x] Asset scanner: auto-detects Ollama models, Whisper STT, Piper voices, wake-word models, 3D characters, animations, reference art and projects under the workspace
- [x] Ollama client (health check, model list, chat) with graceful offline fallback
- [x] Config store at `%APPDATA%\LUNA\config.json` (AI root defaults to `D:\own-ai\`, configurable)
- [x] System tray + window management
- [ ] 3D characters generated from `reference/` (MakeHuman → Mixamo pipeline, spec §32.1)
- [ ] Voice pipeline (Whisper STT, Piper TTS, lip-sync, push-to-talk)
- [ ] Memory, coding agent, VS Code/Windows control, Shoya integration, research/news

## Getting started (dev)

Requirements: **Node.js 20+**, **Ollama** (models already present under `D:\own-ai\models\ollama\`), Git for Windows.

```bash
# point Ollama at the local model library (run once)
setx OLLAMA_MODELS "D:\own-ai\models\ollama"

# install & run
npm install
npm run dev
```

Without Ollama running, the app still works and shows `LUNA • OFFLINE`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run in dev mode with hot reload |
| `npm run typecheck` | Type-check main + renderer |
| `npm run build` | Build to `out/` |
| `npm run package` | Build + package Windows installer (`release/`) |
| `npm run release` | Build + package installer without publishing |

## Workspace layout

`D:\own-ai\` is the configurable AI workspace (spec §3). On first run the app creates the full structure automatically:

```
D:\own-ai\
├── models\        Ollama blobs/manifests, whisper, piper, wakeword   (not in git)
├── characters\    generated 3D models                                (not in git)
├── animations\    animation clips                                     (not in git)
├── voices\        custom voice assets                                 (not in git)
├── projects\      user projects                                       (not in git)
├── memory\        memory database                                     (not in git)
├── config\        workspace config                                    (not in git)
├── reference\     design concept art (look reference only, §2.3)      (not in git)
├── src\           application source (Electron main, preload, renderer)
└── out\           build output (gitignored)
```

Model weights, character files, reference images and the local workspace are **never committed** (spec §30.1).

## Release pipeline

1. `git tag vX.Y.Z`
2. `git push origin vX.Y.Z`
3. GitHub Actions (windows-latest) runs the [`release.yml`](.github/workflows/release.yml): `npm ci` → typecheck → build → `electron-builder --win` → uploads `LUNA-Setup-vX.Y.Z.exe` and creates a GitHub Release.

## Roadmap

See [`plan.md`](plan.md) for the full checkbox tracker and milestones (M1 walking skeleton → M5 shipped).

## License

[MIT](LICENSE)
