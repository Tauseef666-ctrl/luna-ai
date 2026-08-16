AGENTS.md — LUNA Build Split (2 Agents)
This project is split between two agents working in parallel to save time. Each agent owns a clear half of the spec (LUNA_spec_v2_2D.md) and both build against the Shared Contract below so neither blocks on the other. Each agent maintains its own plan.md (see templates: plan-agent-core.md, plan-agent-experience.md) and updates it as work proceeds — that file is the running source of truth for "what's done, what's next, what's blocked."
The Split
Agent A — Core (Systems, AI, Automation, Data)
Owns everything that doesn't render on screen: the app's brain, its data, and its hands.
Agent B — Experience (2D Character, UI, Voice, Dashboard)
Owns everything the user sees and hears: the character, the windows, the voice pipeline, the visual design.
Both agents work inside the same repo, same Electron app — this is a division of responsibility, not two separate codebases. Integration happens continuously through the shared contract, not as one big merge at the end.
Shared Contract (both agents build against this — do not change without updating both plan.md files)
State shape (single source of truth, owned by Core, read by Experience): the `AppState` and `LunaConfig` types live in src/shared/types.ts (shared by main/preload/renderer). Core owns writing config.json; Experience reads it via config:get/set.
IPC channels (Core → Experience, drives character/UI state):
character:setState → { character: "luna"|"shoya", state: "idle"|"listening"|"thinking"|"speaking"|"happy"|"confused"|"working"|"coding"|"searching"|"explaining"|"pointing"|"waiting"|"error"|"success"|"goodbye" }
character:lipsync → { character, visemeStream } (real-time during TTS playback)
character:point → { character, targetX, targetY } (screen coordinates for Visual Guidance, spec §14)
character:subtitle → { character, text }
ai:switched → { active: "luna"|"shoya" }
permission:request → { action, tier: "safe"|"confirm", detail? } (Experience renders the confirmation dialog; Core waits on the response)
permission:resolved → { action, approved: bool } (re-broadcast of permission:response to all windows, for UI feedback)
voice:heard → { text, language } (echo of transcribed user voice, drives dashboard/float feedback)
notification:digest → { summary, items: [...] } (spec §32.5)
IPC channels (Experience → Core, user input/requests):
voice:input → transcribed text + detected language
voice:audio → { wavBase64, sampleRate, language } raw 16 kHz mono WAV; Core transcribes via local Whisper (models\whisper), echoes voice:heard, then routes into the chat flow and replies
hotkey:pressed / wakeword:detected
character:set → { character, state } (dashboard demo controls drive the shared state)
ai:switch → { active: "luna"|"shoya" }
window:floating:reposition / window:floating:resize / window:floating:clickThrough → bool
permission:response → { action, approved: bool }
Config file (owned by Core, read-only for Experience): %APPDATA%\LUNA\config.json — AI root path, provider settings, character rig file paths, user preferences. Current shape: aiRoot, ollamaUrl, theme ("dark"|"light"), wakeWordEnabled, pushToTalk, activeProject, activeAi ("luna"|"shoya"), character{ luna{...}, shoya{...} }, chat{ temperature, maxTokens, systemPrompt }, tts{ enabled, autoSpeak, lengthScale }, voice{ language, micDevice, mode ("ptt"|"always"|"wake"), sensitivity }, float{ width, height, clickThrough, opacity }, automation{ confirm, proactive }, memory{ sessionDays, autoSave, askBeforeDelete }, voiceId{ enabled, guest }, background{ startWithWindows, startMinimized, hotkey }, providers{ id→ProviderConfig }.
Additional IPC channels added by Agent A (Core) 2026-08-16 — all on preload `luna.*`, mirrored in mock-bridge:
- providers:test(id) / providers:status() / providers:chat(id, text) — Provider System; secret:set(ref, value) / secret:has(ref) / secret:delete(ref) — encrypted API keys (DPAPI, never in config.json).
- shoya:detect() / shoya:run(prompt, projectDir?) / shoya:launch(projectDir?) — Shoya persona routing (API provider first, OpenCode CLI fallback).
- router:route(text) — AI Router: returns RouteResult{ target, ok, output, providerId }.
- context:gather(projectDir?) / context:block(projectDir?) — coding context for LUNA-offline-coding + Shoya.
- vscode:status() / vscode:open(path) / vscode:openFile(file) / vscode:openTerminal(dir).
- research:run(query) / research:news(topics?) — online search + offline doc fallback + India-priority news.
New shared types in src/shared/types.ts: ProviderKind/ProviderConfig/ProviderStatus, ShoyaDetection/ShoyaRunResult, RouterTarget/RouteResult, GitStatusLine/CodingContext, VscodeStatus, ResearchSource/ResearchResult/NewsItem/NewsResult.
Asset paths (owned by Core's scanner, referenced by Experience for rendering): D:\own-ai\characters\, D:\own-ai\voices\, D:\own-ai\reference\.
Whoever needs a new channel/state field: propose it in your plan.md, flag it in the other agent's plan.md too, then add it here before using it — the contract file is the only thing that should never silently drift out of sync between the two agents.
Agent A — Core: Task List (spec section references in parens)
Work roughly in this order — later items depend on earlier ones being stable.
Electron app shell & background service (§10, §25) — main process, system tray, "start with Windows," low-resource idle listener, process that keeps running with no window open.
D:\own-ai\ asset scanning system (§3) — folder auto-creation, recursive scan, asset manager data feed for Settings.
AI Provider System (§4) — Gemini/Claude/OpenAI-compatible/Ollama config, encrypted credential storage, Test Connection logic.
Offline-first switching logic (§5) — online/offline detection, fallback to local model, no repeated retry storms.
Memory system (§6, §7) — short/session/long-term/project memory storage, 7-day expiration job, export/delete/search backend.
AI Router / Orchestration Layer (§27, §32.8) — task planner, intent → tool/agent mapping, multi-step/multi-agent chaining, partial-failure reporting.
Shoya backend routing (§1, §16, §17) — OpenCode CLI detection + invocation, provider-API fallback, exact-prompt transmission pipeline, activity log.
Windows Computer Control + permission tiers (§13) — safe vs confirm-required actions, action execution, activity log.
Coding Agent context (§18) — project/git-status/file context gathering for both LUNA-offline-coding and Shoya.
VS Code integration hooks (§15) — open project/file/terminal, load workspace context.
Research Assistant + News Mode backend (§19, §20) — search, source collection, offline document search fallback.
Project Manager backend (§21) — project data model, git status, recent tasks.
Security layer (§24) — Credential Manager integration, permission enforcement, sandboxing, no-credential-logging audit.
Extended capabilities backend (§32.1–§32.7): proactive routines/reminders scheduler, calendar/email/clipboard integrations, action self-verification wrapper around every action call, speaker-recognition voiceprint matching, notification digest aggregation, plugin/skill manifest loader + permission enforcement, browser automation driver.
Build pipeline (§30) — electron-builder config, GitHub Actions workflow (windows-latest), .gitignore for models/assets/reference art.
Agent B — Experience: Task List (spec section references in parens)
2D character rigging pipeline (§2.1, §2.2) — layer separation from img1_nishimiya.png/img2_shoya.png, rig in Live2D Cubism (or Rive fallback), parameter/bone setup (blink, eyebrows, viseme mouth shapes, head turn, arm poses, idle sway), export to D:\own-ai\characters\, then remove rigging tooling from the project once assets exist.
Floating window (§2.3, §9) — transparent frameless Electron window, character canvas render loop, idle/breathing/blink loop, subtitle bar, status line, voice waveform, drag/resize/always-on-top/click-through, voice-command repositioning.
Lip-sync + gesture playback (§2.3, §11, §12) — wire character:lipsync and character:setState IPC events to the rig's parameters; barge-in interrupt animation (stop mid-speech instantly on "Stop").
Design system implementation (§2.4) — dark-mode palette, glassmorphism panel components, typography, spacing grid, motion/transition timing as a shared component library used across dashboard/settings/memory/project screens.
Main Dashboard (§8) — window chrome, navigation (Chat/Projects/AI Models/Memory/Shoya/Research/Automation/Settings), theme switching.
AI Dashboard status cards (§22) — online/offline indicators, model/provider display, accent-color distinction between LUNA/Shoya, wired to the shared state shape.
Settings screens (§23) — General/AI/Voice/Character/Memory/Automation/Paths panels, all reading/writing through Core's config channel.
Voice pipeline UI layer (§11) — mic input capture, STT hookup, language selection UI, TTS playback triggering the lip-sync channel.
Visual Guidance overlay (§14) — on-screen highlight/arrow rendering driven by character:point.
Project Manager UI (§21) — project cards, buttons wired to Core's project actions.
System tray UI/menu (§25) — tray icon states, menu wiring to Core's background service.
Notification digest UI (§32.5) — "what did I miss" summary card/toast.
Speaker/voice enrollment UI (§32.4) — enrollment flow, re-enroll option, guest-mode indicator.
UI Animations polish pass (§29) — transitions, hover states, loading indicators, AI-switch animation, cross-fade between character states.
Global command feedback (§26, §27.1) — visible confirmation ("Switched to Shoya"), permission-confirmation dialogs (renders permission:request, sends permission:response).
Working Rules
Neither agent modifies the other's owned files without a note in both plan.md files first.
If a task needs something the other agent hasn't built yet, stub it against the Shared Contract (mock the IPC channel/state) rather than waiting — swap in the real implementation once it lands.
Update your plan.md at the end of each work session, not just at task completion — "in progress, blocked on X" is useful information too.
Both agents follow the design decisions already locked in LUNA_spec_v2_2D.md §33 (Resolved Decisions Log) — don't re-litigate Ollama vs GGUF, Live2D vs Babylon, etc.