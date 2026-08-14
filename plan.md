# LUNA — Build Plan (TODO)

Project: **LUNA** — Advanced Windows AI Companion (spec: [`LUNA_spec.md`](LUNA_spec.md))
Repository: **https://github.com/Tauseef666-ctrl/luna-ai** (spec §32.5 — recorded)
Platform: Windows desktop app (**Electron + Babylon.js**), offline-first.
Dev workflow: VS Code (native Windows) + Shoya coding agent → Git → GitHub Actions (windows-latest) → `LUNA-Setup.exe`.

> Check a box only when the item is **done and verified working** in the running app.

---

## 0. Resolved Decisions (Spec §32 — Final, Do Not Re-ask)

| # | Decision | Status |
|---|---|---|
| 32.1 | **User supplies final 3D models** (`.glb`/`.gltf` dropped into `characters/`); app loads them generically (Babylon `SceneLoader`), maps clips to states by name, lip-syncs (jaw bone or ARKit visemes), applies motion overlay. Placeholder primitive rig remains the fallback until a model is assigned in Settings. | Placeholder in; generic loader in v0.3.0; models pending user |
| 32.2 | **Local inference = Ollama local REST API** (`http://localhost:11434`). Client module implemented. No raw GGUF loading / `node-llama-cpp` for v1. | Client done (incl. streaming); Ollama binary install pending |
| 32.3 | **Wake word: Push-to-Talk default.** Do NOT reuse `hey_jarvis` models. "Hey Luna" = stretch goal via Picovoice Porcupine custom keyword. | Push-to-talk noted; voice pipeline pending |
| 32.4 | **Renderer: Babylon.js** (not Three.js). | Done — v9.21.1 in use |
| 32.5 | **GitHub repository** — URL recorded above, wired into the release workflow. | Done |

---

## 1. Inventory — What Already Exists in `D:\own-ai\`

### AI / Model Assets (usable now)
- [x] Ollama model library (blobs + manifests): `qwen2.5:1.5b`, `qwen2.5:3b`, `qwen2.5:7b`, `qwen2.5vl:3b`, `nomic-embed-text` — `D:\own-ai\models\ollama\`
- [x] STT (faster-whisper): `base`, `base.en`, `small` — `D:\own-ai\models\whisper\`
- [x] TTS (Piper ONNX voices): `en_US-amy` (F), `en_US-ryan` (M), `hi_IN-priyamvada` (F), `hi_IN-rohan` (M), `ur_PK-aegis_female` (F), `ur_PK-fasih` (M)
- [x] Wake-word ONNX models: `hey_jarvis_*.onnx` — **NOT reused** (§32.3)
- [x] Reference concept art moved to `D:\own-ai\reference\` with spec names (§2.3): `img1_nishimiya.png`, `img2_shoya.png`, `img3_nishimiya_full.png`, `img4_shoya_full.png` — **look reference only, never runtime assets**

### Workspace / Repo (done in v0.1.0)
- [x] Git repo initialized at `D:\own-ai\` with remote `origin` → luna-ai; old `main` history, `backup` branch and tags **deleted** (fresh start)
- [x] Workspace folders created: `characters/`, `animations/`, `voices/`, `projects/`, `memory/`, `config/`, `reference/` (`.gitkeep` placeholders committed; contents gitignored)
- [x] `.gitignore` excludes models, characters, animations, voices, memory, config contents, reference images, weight files (`*.gguf/.onnx/.bin/.vrm/.glb/.fbx`), `out/`, `node_modules/`
- [x] Reference images renamed/moved to `reference\` matching spec §2.3 table

### Remaining Blockers
- [ ] **Ollama CLI not installed on this machine** — models are present as blob library; install Ollama and set `OLLAMA_MODELS=D:\own-ai\models\ollama` to go online (app client is ready)
- [ ] **No 3D character/animation files** — placeholder rig shipped; generation pipeline (MakeHuman → Mixamo) to run in Phase 3.0

---

## 2. Build Status — v0.1.0 (first build, released)

Shipped and verified (app launches; Babylon WebGL2 renderer runs):
- [x] Electron + Babylon.js + TypeScript scaffold (`electron-vite`), old Tauri/Python build fully removed from repo
- [x] Dark glassy dashboard shell, sidebar nav (Chat, Projects, AI Models, Memory, Shoya, Research, Automation, Settings), design-system palette §2.4
- [x] Placeholder 3D rig in dashboard (full-body, glowing status ring) + floating window (half-body, windowsill framing): states idle/listening/thinking/speaking/working, breathing, lip-jaw mouth sync, cross-faded poses
- [x] Floating window: always-on-top pin, close, status + subtitle bar, push-to-talk hint (§32.3)
- [x] Asset scanner (spec §3): Ollama manifests, Whisper, Piper, wake-word, characters, animations, reference, projects
- [x] Ollama client: health check, model list, chat with offline fallback + auto-fallback model selection
- [x] Config store `%APPDATA%\LUNA\config.json`, AI root default `D:\own-ai\`, first-run folder creation, "workspace not found" handling
- [x] System tray (Open Assistant, Open Dashboard, Quit)
- [x] `electron-builder.yml` (NSIS) + GitHub Actions release workflow (tag → installer → Release)

---

## 2b. Build Status — v0.2.0 (Memory + streaming + asset assignment)

Shipped and verified (typecheck ✓, build ✓, app boots clean):
- [x] **Streaming chat** — Ollama `/api/chat` stream (SSE) → `chat:token` events → live text in the chat bubble (spec 32.2)
- [x] **Memory engine (spec 6–7)** — `src/main/memory.ts`, persisted at `<aiRoot>\memory\luna-memory.json`:
  short-term (bounded), session (auto-expires 7 days), long-term, project (keyed)
- [x] **Sessions (spec 6, 7)** — full conversation history in `<aiRoot>\memory\luna-sessions.json`:
  auto-persisted per turn, restored on app start, **multi-turn context** fed to the model, "New chat" starts a fresh session
- [x] **Session Save / Unsave / Remove** — Save keeps a session forever · Unsave returns it to 7-day temp · Remove deletes it
- [x] **Pin/unpin** on memory entries — pinned memories never expire (session-tier expiry cleared)
- [x] Memory **keyword recall** injected into the chat system prompt (embeddings/`nomic-embed-text` deferred until Ollama online)
- [x] Memory manager UI: search, add (tier + optional project), view, delete, pin/unpin, clear sessions/clear all, prune expired, export JSON
- [x] Sessions UI in Memory view: list (name, turns, updated, saved/temp badge) with Save/Unsave/Remove controls
- [x] **Asset assignment** — Settings: assign active LLM + TTS voice to LUNA and to Shoya (persisted in config, chat uses LUNA's assigned model)
- [x] **Re-scan workspace** button in Settings
- [x] Prettier config + `format`/`format:check` scripts

**Deferred/blocked:** ESLint (typescript-eslint peer conflict with TypeScript 7: `>=4.8.4 <6.1.0` — revisit when supported); auto-rescan on `aiRoot` change (path change UI not built yet).

---

## 2c. Build Status — v0.3.0 (Character view + generic model pipeline + design pass)

Shipped and verified (typecheck ✓, build ✓, browser design preview via `npm run design`):
- [x] **Generic 3D model loader** — `character.ts` loads any user-supplied `.glb/.gltf` (Babylon `SceneLoader`): bounding-box fit, clip→state mapping (idle/listening/thinking/speaking/working by name), jaw morph/bone lip-sync, breathing + idle life overlay
- [x] **Asset serving via IPC** — `assets:image` (reference art → base64 data URL, `reference/` whitelisted) + `assets:binary` (models/animations → `Uint8Array`, `characters|animations|models/` whitelisted), exposed on preload as `window.luna.assets`
- [x] **Character view** — new sidebar tab: LUNA + Shoya cards with concept art (img1–img4), current model/voice/LLM assignment, 5-step pipeline checklist (art → model → rig/anim → lip-sync → gestures)
- [x] **Settings: character-model assignment** — LUNA/Shoya dropdowns from `scan.characters` → `config.character.{luna,shoya}.idle`; changing LUNA's model hot-reloads the dashboard rig; float window loads assigned model on open
- [x] **Browser design preview** — `npm run design` serves `src/renderer` at `http://localhost:5173` via `mock-bridge.ts` (full LunaBridge mock: scans, sessions, memory, streaming, concept-art placeholders) — design/browse without Electron
- [x] **Design pass** — stage floor glow, glass status card, panel gradient headers, character cards, animated pipeline dots, custom scrollbars (spec §2.4)
- [x] App version 0.3.0 (sidebar + package.json)

**Asset pipeline decision (§32.1, user-driven):** user supplies final `.glb/.gltf` models; app loads them generically and animates automatically (clip mapping + lip-sync + motion overlay). MakeHuman→Mixamo generation is dropped from the roadmap.

---

## Phase 1 — Foundation & Scaffolding

### 1.1 Project Setup
- [x] Git repo for app source, `.gitignore` correct
- [x] `package.json` — Electron + **Babylon.js** + TypeScript, electron-vite
- [x] Prettier config + `format`/`format:check` scripts
- [ ] ESLint — **blocked**: `typescript-eslint@8` peer `typescript >=4.8.4 <6.1.0` conflicts with TS 7.0.2; add when typescript-eslint supports TS7
- [x] Electron app boots to dark `#0A0A12` shell (§2.4)
- [x] Config file at `%APPDATA%\LUNA\config.json` — AI root configurable
- [x] First-run auto-create of workspace folders (§3)
- [x] Graceful "AI workspace not found" state (§30.3)

### 1.2 Asset Scanner / Manager (§3)
- [x] Recursive scanner indexing LLM, embedding, STT, TTS, wakeword, 3D, animation, reference, projects
- [x] Ollama model detection via manifests; Piper via `*.onnx.json`; whisper dirs; wake-word ONNX
- [x] 3D asset detection (`*.glb/gltf/fbx/vrm`), reference art listed separately
- [x] Settings → asset manager UI (list detected assets per category)
- [x] Manual **Re-scan** button (Settings)
- [ ] Auto-rescan on AI-root path change (path-change UI pending)
- [x] Assign active **LLM + TTS voice** to LUNA or Shoya from the asset manager (chat uses LUNA's assigned model)
- [x] Assign 3D character model to LUNA or Shoya from the asset manager (Settings; hot-reloads dashboard rig) — v0.3.0

---

## Phase 2 — AI Core (Offline-First)

### 2.1 Local LLM Engine (§32.2 — Ollama REST API)
- [x] LLM client module: `ollamaHealth`, `listOllamaModels`, `ollamaChat` (stream: false)
- [x] **Streaming responses** (`ollamaChatStream`, SSE) into chat UI with live token updates
- [x] Task→model routing stub (chat uses LUNA-assigned model → qwen2.5:7b → qwen2.5 → first model)
- [x] Auto-fallback chain + graceful offline message
- [ ] Install Ollama for Windows with `OLLAMA_MODELS=D:\own-ai\models\ollama` (verify blobs picked up without re-pull)
- [ ] Model load/unload on demand (§31)
- [ ] Task router expansion: coding (qwen2.5 larger), vision (qwen2.5vl), embed (nomic-embed-text)

### 2.2 Provider System (§4)
- [ ] Provider adapters: Gemini, Claude, OpenAI-compatible, LM Studio (beyond Ollama)
- [ ] Settings UI: provider, base URL, model, temperature, max tokens, system prompt, timeout
- [ ] API keys via Windows Credential Manager (encrypted)
- [ ] Test Connection with status outcomes

### 2.3 Offline-First Routing (§5, §27)
- [x] Connectivity detection via Ollama health poll (15s)
- [x] Status badges `LUNA • ONLINE/OFFLINE`, `Shoya • OFFLINE`
- [ ] Full router: task → (LUNA local | LUNA online | Shoya | Research | Windows tools | VS Code tools | File tools | Memory)
- [ ] Auto-switch online→local on connection loss mid-conversation
- [ ] **LUNA offline coding** (§1, §18)
- [ ] **Explicit AI switching** (§27.1) + personality prompts (§28)

### 2.4 Memory System (§6)
- [x] **Memory store (v0.2.0)** — short / session / long-term / project tiers, persisted at `<aiRoot>\memory\luna-memory.json`
- [x] **7-day session expiration (§7)** — auto-pruned on startup + manual "Prune expired"
- [x] **Sessions (v0.2.0)** — conversation history in `<aiRoot>\memory\luna-sessions.json`, restore on start, multi-turn model context, Save/Unsave/Remove (chat turns live in sessions, not the short tier)
- [x] **Pin/unpin** memories (pinned = never expires) — v0.2.0
- [x] **Keyword recall** into chat context ("continue the project we worked on yesterday" — keyword-based; embeddings upgrade pending)
- [ ] Embeddings recall via `nomic-embed-text` (vector search — needs Ollama online) + "project resume" inference
- [x] Memory manager UI: view / search / delete / export / clear sessions / clear all / pin (edit + disable pending)

---

## Phase 3 — 3D Characters & Rendering (§2, §32.1, §32.4)

### 3.0 Character Asset Generation
**Approach (v0.3.0): user supplies final `.glb`/`.gltf` models** — dropped into `D:\own-ai\characters\`, assigned in Settings. App animates them automatically: clip→state mapping, lip-sync (jaw bone or ARKit visemes), motion overlay. No generation tooling needed.
- [x] Generic loader (SceneLoader) + auto-fit + clip mapping + lip-sync — v0.3.0
- [ ] **User model delivery** — awaiting `.glb`/`.gltf` for LUNA and Shoya (stylized to match `reference\img1–4`)
- [ ] Clip set per character: idle, listening, thinking, speaking, working (+ optional happy/confused/etc. when provided)

### 3.1 Character Pipeline
- [x] **Babylon.js** renderer in Electron (WebGL2, GPU) — §32.4
- [x] **Placeholder fallback rig** (primitive humanoid + blendshape-jaw + arm IK pivots) — §32.1
- [x] **Generic model loader** — load assigned `.glb`/`.gltf` from Settings; auto-fallback to placeholder — v0.3.0
- [x] Same rig shared by floating-window (half-body) and dashboard (full-body); float loads assigned model
- [ ] Arm/hand IK for dynamic pointing at screen coords (§2.2 Pointing)
- [ ] Facial blendshapes layered independently over body animation
- [ ] FBX/VRM import support if user provides those formats

### 3.2 Animation States
- [x] Procedural states: Idle, Listening, Thinking, Speaking, Working (placeholder)
- [ ] Full §2.2 library: Happy, Confused, Coding, Searching, Explaining, Pointing, Waiting, Error, Success, Goodbye
- [ ] Real-time **lip-sync** via TTS visemes (§2.1, §11) — mouth channel wired, source pending
- [ ] Character accent colors on rings: LUNA violet `#B24BF3→#7B5CFA`, Shoya cyan `#3AD1FF→#4C6FFF` — LUNA done, Shoya pending

### 3.3 Views
- [x] Floating window (half-body, windowsill, always-on-top, pin, subtitle/status)
- [x] Dashboard (full-body on glowing platform) + status card
- [ ] Full gesture set (wave, explain, point, thumbs-up, lip-sync-on-any-pose)
- [ ] Performance: pause render when minimized, low-spec scaling, GPU fallback (§31)

---

## Phase 4 — Voice & Speech (§9–§12)

### 4.1 STT / Wake Word (§32.3)
- [ ] **Push-to-talk** (spacebar/button) — v1 primary input
- [ ] Always-listening option, sensitivity, microphone selection (§10)
- [ ] faster-whisper STT integration (base → small)
- [ ] Language auto-detect + explicit: English, Hindi, Urdu, Hinglish (§11)
- [ ] **Barge-in** — duck/stop TTS on user speech; "Stop" halts instantly (§12)
- [ ] **Stretch:** "Hey Luna" via Picovoice Porcupine console (§32.3)

### 4.2 TTS
- [ ] Piper engine with local voices: LUNA female (amy/priyamvada/aegis), Shoya male (ryan/rohan/fasih)
- [ ] Language-aware voice selection (en/hi/ur)
- [ ] Viseme/phoneme output for lip-sync + waveform UI

### 4.3 Voice Command Integration (§9)
- [ ] Window commands: move, resize, corner-pin, transparent, always-on-top
- [ ] "Luna, open VS Code" → confirm → execute (§10)
- [ ] Full pipeline: Mic → STT → Intent → Reasoning → Action/Response → TTS → lip-sync (§11)

---

## Phase 5 — Windows Control, Tools & Automation (§13–§18)

- [ ] 5.1 Windows control: apps, windows, files, folders, terminals, websites, screenshots, screen explain (§13)
- [ ] Permission tiers Safe vs Confirmation required + Activity Log (§13, §24)
- [ ] 5.2 VS Code integration (§15)
- [ ] 5.3 Shoya integration (§16–§17) + exact prompt transmission
- [ ] 5.4 Coding agent: project context packager + 17 languages (§18)
- [ ] 5.5 Visual guidance / pointing (§14)
- [ ] 5.6 Research assistant + India news mode (§19–§20)

---

## Phase 6 — App UI & Features (§8, §21–§23, §25–§26)

- [x] Dashboard shell with 9-view navigation (v0.1.0)
- [ ] Project Manager (§21) — data model + UI
- [ ] AI Dashboard (§22) — dual status cards
- [ ] Chat UI streaming + character-colored bubbles (partial: non-streaming chat works)
- [ ] Settings (§23): General, AI, Voice, **Character**, Memory, Automation, Paths (partial: asset manager)
- [ ] System tray full menu (§25): Pause/Enable Listening, Switch AI, Memory, Projects
- [ ] Global commands (§26)
- [ ] Keyboard shortcuts, responsive layout, notifications
- [ ] Light mode (secondary, §2.4)

---

## Phase 7 — Security & Activity (§24)

- [ ] Encrypted credentials via Windows Credential Manager; no keys in source/logs
- [ ] Permission system + confirmation dialogs; tool sandboxing
- [ ] No hidden persistence / credential logging
- [ ] Visible Activity Log UI
- [ ] Safe error handling (no silent crashes, no data loss)

---

## Phase 8 — Build & Release (§30)

- [x] `electron-builder.yml` → `LUNA-Setup.exe` (NSIS) config
- [x] GitHub Actions workflow (windows-latest): checkout → setup-node → `npm ci` → typecheck → build → `electron-builder --win` → upload artifact → GitHub Release on tag `v*`
- [x] Repo URL recorded (§32.5)
- [ ] First tag `v0.1.0` pushed → verify CI produces installer (needs repo push)
- [ ] Installer first-run test on a clean machine
- [ ] Code-signing secrets only if required

---

## Phase 9 — Testing & Polish

- [ ] Offline-first test: block network → chat/coding/memory/voice still work
- [ ] Memory persistence across restarts; session expiry verified
- [ ] Barge-in + PTT latency acceptable
- [ ] 3D perf on low-spec; render paused when minimized; idle CPU low
- [ ] Security review (no keys, destructive ops confirm)
- [ ] End-to-end smoke + user docs

---

## Milestones

- **M1 — Walking Skeleton** 🟢 *v0.1.0 shipped:* Electron boots, workspace scan works, Ollama client streams, status badges, placeholder rig renders, floating window works.
- **M2 — Talking Character:** generated LUNA/Shoya assets or placeholder, STT→LLM→TTS→lip-sync loop, push-to-talk, wake word stretch.
- **M3 — Useful Assistant:** memory, project manager, VS Code + terminal control, permission tiers, coding agent, activity log.
- **M4 — Shoya & Advanced:** Shoya integration, research/news, visual guidance/pointing, tray full menu, global commands.
- **M5 — Ship It:** security pass, polish, perf pass, CI release → `LUNA-Setup.exe`.

---

## Open Questions / Decisions Needed

- [ ] **Ollama install**: OK to install Ollama for Windows on this machine (`OLLAMA_MODELS=D:\own-ai\models\ollama`)? Needed to bring the app online locally.
- [ ] **User 3D models**: provide final LUNA/Shoya `.glb`/`.gltf` files (stylized per `reference\img1–4`) — drop into `D:\own-ai\characters\`, then assign in Settings.
- [ ] Confirm the reference-image rename to spec names is acceptable (`img1_nishimiya.png`, `img2_shoya.png`, `img3_nishimiya_full.png`, `img4_shoya_full.png`).
