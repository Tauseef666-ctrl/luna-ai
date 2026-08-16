# LUNA — Build Plan (TODO)

Project: **LUNA** — Advanced Windows AI Companion (spec: [`luna-spec.md`](luna-spec.md) — **v2, 2D Character Pivot**)
Repository: **https://github.com/Tauseef666-ctrl/luna-ai** (spec §32.5; plan records actual URL)
Platform: Windows desktop app (**Electron**), offline-first.
Dev workflow: VS Code (native Windows) + Shoya coding agent → Git → GitHub Actions (windows-latest) → `LUNA-Setup.exe`.

> Check a box only when the item is **done and verified working** in the running app.
>
> **v2 spec delta (read `luna-spec.md` first):** rigged 2D characters (Live2D/Rive, from img1/img2 art), **true floating-window transparency**, **always-on background service + wake word (tray-resident)**, AI Provider System (Gemini/Claude/OpenAI-compat/Ollama, Windows Credential Manager), Shoya = persona routing to OpenCode CLI + providers, full §32 in scope (proactive routines, reminders, calendar/email/clipboard, action self-verification, speaker recognition, digest, plugin/skills, browser automation, multi-agent orchestration).

---

## 0. Resolved Decisions (Spec §33 — Final, Do Not Re-ask)

| # | Decision | Status |
|---|---|---|
| 32.1 | **Rigged 2D characters** (VTuber-style): Live2D Cubism preferred, **Rive** acceptable lighter-weight fallback — built from `reference\img1_nishimiya.png` (LUNA) + `img2_shoya.png` (Shoya). Runtime plays finished rig (`.moc3`/`.riv`) in `D:\own-ai\characters\`; rigging/segmentation tools are dev-time-only. **No 3D, no Babylon/Three, no procedural model generation.** | Interim CSS-motion rig in; Live2D/Rive pipeline pending |
| 32.2 | **Local inference = Ollama local REST API** (`http://localhost:11434`). Client module implemented. No raw GGUF / `node-llama-cpp` path. | Client done (incl. streaming); Ollama install in progress |
| 32.3 | **Background service always running** (tray-resident, "Start with Windows" opt-in). Push-to-talk is the default trigger; "Hey Luna" wake word = stretch via Picovoice Porcupine. Floating window must appear on wake/hotkey without opening the dashboard. | Architecture pending (v2 §10) |
| 32.4 | **Renderer: Live2D Cubism SDK for Web or Rive** on a WebGL/Canvas layer in Electron for the 2D character. | Pipeline pending |
| 32.5 | **GitHub repository** — recorded in plan; wired into the release workflow. | Done (repo URL known) |

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
- [~] **3D character/animation files** — **resolved by the v0.4.0 2D pivot**: characters are the concept art themselves, animated by CSS; no 3D files needed

---

## 2. Build Status — v0.1.0 (first build, released)

> Historical note: v0.1.0 shipped a Babylon.js 3D placeholder stage; **the renderer pivot in v0.4.0 replaced it with animated 2D characters** (see §2e, §32.4) and removed the Babylon runtime.

Shipped and verified (app launches):
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

## 2c. Build Status — v0.3.0 (Character view + 3D loader prototype + design pass)

Shipped and verified (typecheck ✓, build ✓). **Superseded in v0.4.0**: the 3D loader + model assignment below were replaced by the animated-2D pivot (§2e) — kept here for history:
- [x] **Generic 3D model loader** (prototype) — `character.ts` loaded `.glb/.gltf` via Babylon `SceneLoader` (bounding-box fit, clip→state mapping, jaw morph/bone lip-sync) — **removed with the 3D pivot**
- [x] **Asset serving via IPC** — `assets:image` (reference art → base64 data URL, `reference/` whitelisted) + `assets:binary` (models/animations → `Uint8Array`, `characters|animations|models/` whitelisted), exposed on preload as `window.luna.assets`
- [x] **Character view** — new sidebar tab: LUNA + Shoya cards with concept art (img1–img4), voice/LLM assignment, pipeline checklist
- [x] **Settings: character-model assignment** (prototype) — LUNA/Shoya model dropdowns from `scan.characters` → `config.character.{luna,shoya}.idle` — **removed with the 3D pivot** (voice/LLM assignment kept)
- [x] **Browser design preview** — `npm run design` serves `src/renderer` at `http://localhost:5173` via `mock-bridge.ts` (full LunaBridge mock: scans, sessions, memory, streaming, concept-art placeholders) — design/browse without Electron
- [x] **Design pass** — glass panels, character cards, animated pipeline dots, custom scrollbars (spec §2.4)
- [x] App version 0.3.0 (sidebar + package.json)

**Asset pipeline decision (§32.1, flipped in v0.4.0):** 3D generation (MakeHuman→Mixamo) and user-supplied `.glb` models are **dropped**. LUNA/Shoya render as **2D animated characters** driven by their concept art.


---

## 2d. Build Status — v0.4.0 (chat settings, projects, activity log, long-context)

Build in progress (typecheck ✓; not yet committed — deferred to save GitHub Actions quota):
- [x] **Config-driven chat behavior** — Settings: temperature, max tokens, editable system prompt (persona) — persisted in config and actually applied to the Ollama request (`options.temperature` / `options.num_predict`)
- [x] **Project manager (Phase 5 core)** — `src/main/projects.ts`: list / create / rename / delete under `<aiRoot>\projects\`; Projects view with active-project selector; active project's notes (project-tier memory) injected into the chat system prompt
- [x] **Activity log (spec §17 core)** — `src/main/activity.ts`, persisted at `<aiRoot>\memory\luna-activity.json`; logged events: app start, scan, config change, chat send/error, session create/save/unsave/remove, memory add/delete, project create/rename/delete; Settings view lists latest 100 with Clear
- [x] **Long-session context** — turns older than the last 12 are summarized via the assigned model (temperature 0.2) and injected as a rolling "conversation summary" system message (naive truncation fallback when offline)
- [x] `projects` + `activity` preload bridges and mock-bridge mirrors (browser preview parity)

---

## 2e. Build Status — renderer pivot (2D animated characters, both companions; ships in v0.4.0)

User feedback: "drop the 3D model / it looks heavy — show both characters side by side, moving, with 2D animations." Implemented (uncommitted, bundles with the v0.4.0 commit):
- [x] **Renderer pivot — Babylon.js removed** — deps (`@babylonjs/*`) dropped from `package.json`; `character.ts` rewritten as a **CSS/HTML 2D motion rig** over the concept art (no WebGL, ~14 MB → <1 MB bundle, 4.5 min → ~40 s build)
- [x] **LUNA = `img1_nishimiya.png`, Shoya = `img2_shoya.png`** — the actual concept art is now the live character visual everywhere (`assets:image` IPC)
- [x] **Dashboard shows both characters side-by-side** — LUNA (violet) + Shoya (cyan), each breathing/animating and cycling their own "works" activity captions
- [x] **Floating window hosts both characters** — drag LUNA and Shoya anywhere to reposition (pointer-drag with bounds clamping); both react to chat states (LUNA mirrors state; Shoya listens while LUNA speaks)
- [x] **Character view live preview** — both characters large and moving; Idle/Listening/Thinking/Speaking/Working test buttons drive the animations on demand
- [x] **Animation states** — idle float, listening sway, thinking tilt, speaking bounce + speech equalizer bars + glowing pulse, working pulse; hover = friendly wave
- [x] State-driven captions/tickers; Shoya has its own activity lines

---

## 2f. Build Status — v2 spec alignment (in progress, uncommitted)

Aligning the shipped v0.4.0 to the v2 spec (`luna-spec.md`). Work items (v0.5.0):
- [ ] **True transparent floating window** (§2.3) — `transparent: true` frameless window, no visible panel/box behind the character, only character + subtitle/status bar over the desktop
- [ ] **Background service (§10)** — tray-resident main process (no window on start), "Start with Windows" opt-in, push-to-talk global hotkey summons the floating window without opening the dashboard, lightweight idle (no rig rendering)
- [ ] **AI Provider System (§4)** — unified providers: Ollama (local) + Google Gemini + Anthropic Claude + OpenAI-compatible; API keys in Windows Credential Manager (no hardcoded keys); Settings per-provider (Base URL, Model, Temperature, Max Tokens, System Prompt, Timeout) + Test Connection (Connected/Disconnected/Invalid Key/Rate Limited/Offline/Model Unavailable)
- [ ] **Shoya = persona routing (§1, §16)** — auto-detect Shoya backends (OpenCode CLI on PATH / known dirs / VS Code extension), per-task routing, "Open Shoya for this project and continue"
- [ ] **2D rig pipeline (§2.2)** — Live2D (`.moc3`) or Rive (`.riv`) rig produced from img1/img2 (dev-time tooling by Shoya, removed after export) → rendered on WebGL canvas in Electron; interim: current CSS-motion characters remain until rig files exist
- [ ] **Action self-verification (§32.3)** — verify results (file exists / exit code) before reporting success
- [ ] **Plugin/Skill system (§32.6)** — `skills/<name>/manifest.json` registry, permission tiers, Skills manager in Settings→Automation
- [ ] **Proactive routines + reminders (§32.1)** — time-based routines, one-off/recurring reminders fired by the background service, quiet hours
- [ ] **Calendar/Email/Clipboard (§32.2)** + **Notification digest (§32.5)** + **Browser automation (§32.7)** + **Orchestration (§32.8)** — scoped after core items

---

## Phase 1 — Foundation & Scaffolding

### 1.1 Project Setup
- [x] Git repo for app source, `.gitignore` correct
- [x] `package.json` — Electron + TypeScript, electron-vite (Babylon removed in v0.4.0 — 2D renderer)
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
- [~] Assign 3D character model — **removed with the v0.4.0 2D pivot** (characters are the concept art themselves; no model files needed)

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

## Phase 3 — Characters & Rendering (§2, §32.1, §32.4) — 2D animated

**Approach (v0.4.0, final): 2D animated characters.** LUNA = `reference\img1_nishimiya.png`, Shoya = `reference\img2_shoya.png`. A CSS/HTML motion rig (`src/renderer/src/character.ts`) animates them via per-state keyframes; no 3D engine, no model files, no generation tooling.

### 3.1 Character Pipeline
- [x] **2D motion rig** — breathing float, listening sway, thinking tilt, speaking bounce + speech equalizer, working pulse, hover wave (v0.4.0)
- [x] **Live art via IPC** — concept images served as data URLs (`assets:image`), `img1`/`img2` are the runtime visuals (v0.4.0)
- [x] **Dashboard: LUNA + Shoya side-by-side**, each with own state + activity ticker (v0.4.0)
- [x] **Floating window: both characters, draggable** — pointer-drag repositions them in the frame; states mirror chat (v0.4.0)
- [x] **Character view: live preview** — large animated characters + Idle/Listening/Thinking/Speaking/Working test buttons (v0.4.0)
- [ ] **TTS lip-sync** — equalizer/mouth rhythm driven by real voice output (voice engine pending, §4.2)
- [ ] **2D sprite upgrade** (optional, user-supplied) — animated sprite sheets / frame strips replace the static art; same state rig applies

### 3.2 Animation States
- [x] Procedural states: Idle, Listening, Thinking, Speaking, Working (2D, v0.4.0)
- [ ] Full §2.2 library: Happy, Confused, Coding, Searching, Explaining, Pointing, Waiting, Error, Success, Goodbye
- [ ] Character accent glows: LUNA violet `#B24BF3→#7B5CFA`, Shoya cyan `#3AD1FF→#4C6FFF` — both wired in v0.4.0

### 3.3 Views
- [x] Floating window (both characters, always-on-top, pin, subtitle/status, drag to move)
- [x] Dashboard (LUNA + Shoya on glowing stage) + status card
- [ ] Full gesture set (wave, explain, point, thumbs-up) as 2D sprite animations when sprites arrive
- [ ] Performance: pause animations when minimized (CSS `animation-play-state`) — trivial once wired


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
- [ ] **Character art direction**: confirm LUNA = `img1_nishimiya.png` and Shoya = `img2_shoya.png` as their live visuals (currently the app's default). Optional: user-supplied 2D sprite sheets later for richer motion.
- [ ] Confirm the reference-image rename to spec names is acceptable (`img1_nishimiya.png`, `img2_shoya.png`, `img3_nishimiya_full.png`, `img4_shoya_full.png`).
