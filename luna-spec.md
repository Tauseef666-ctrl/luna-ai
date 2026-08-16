LUNA — Advanced Windows AI Companion (v2 — 2D Character Pivot)
Changelog from v1: The 3D pipeline (Babylon.js, rigged .glb/.vrm models, procedural model generation) has been dropped entirely. LUNA and Shoya are now 2D animated characters built directly from the existing reference art (img1_nishimiya.png, img2_shoya.png). This version also tightens the floating-window requirements (true background transparency) and makes the wake-word/background-service behavior explicit, since the previous build did not deliver a solid, professional Windows app.
Build a fully functional Windows desktop EXE AI companion named "LUNA" — a real, polished Windows application, not a webpage-in-a-window. It combines an offline local AI, an online coding companion named Shoya, 2D animated characters, voice interaction, memory, coding automation, research, Windows control, and a futuristic assistant dashboard. The app must run reliably in the background and respond to its wake word even when no window is visibly open.
1. Core Concept
Two AI personalities:
LUNA — the primary offline AI companion. Gentle, friendly, intelligent, patient, warm. Operates primarily on local models via Ollama, auto-selecting the right local model per task (conversation, coding, summarization, reasoning, file understanding, offline research, computer guidance, project assistance), with automatic fallback if the preferred model is unavailable.
LUNA has full coding capability offline. She is not limited to conversation — she can read, write, edit, refactor, and debug code using a local code-tuned model, run approved terminal commands and interpret output, and continue an existing project without internet. Shoya remains the specialized, typically-online agent best suited for larger multi-file builds and long coding sessions; LUNA's offline coding is always available for everyday edits, fixes, and continuing work when Shoya isn't invoked.
Shoya — the second, switchable, online-capable coding assistant persona. Focused, technical, practical, confident, developer-oriented. Specializes in programming, debugging, Git, GitHub workflows, VS Code, Windows Terminal/PowerShell, project architecture, code generation, refactoring, testing, documentation, build systems, and GitHub Actions/DevOps tasks.
Shoya is a persona, not a single backend. Underneath his character and voice, Shoya routes each coding task to whichever configured backend fits best: the local OpenCode CLI tool (auto-detected per Section 16), or any configured API provider from the Provider System (Section 4) — Claude, Gemini, GPT/OpenAI-compatible endpoints, etc. The user's default-provider setting or task type determines which backend handles a given request; the character, voice, and personality stay consistent as "Shoya" regardless of which backend is actually doing the work underneath. This mirrors how LUNA already picks between local models — Shoya does the same across coding backends.
Both characters have an original visual identity inspired by the user's reference art — not a direct copy of any existing copyrighted character's likeness or dialogue.
2. 2D Character & Animation System
This replaces any 3D pipeline. LUNA and Shoya are rendered as rigged 2D characters — think VTuber-style animated illustration, not flat static images and not a 3D mesh.
2.1 Source Art
Two reference portraits, already provided, live in D:\own-ai\reference\:
File
Character
Description
img1_nishimiya.png
LUNA
Half-body, resting arms on a window-frame ledge, soft expression
img2_shoya.png
Shoya
Half-body, resting arms on a window-frame ledge, calm/focused expression
These two images are the actual base art the 2D rig is built from — not just a style guide. The build pipeline separates each illustration into animatable layers/parts (hair, face base, eyebrows, eyes, eyelids, mouth, arms/hands, torso, background) so they can be independently moved, without redrawing the character from scratch. Full-body versions (for the dashboard, if/when added later) can be generated from the same character design, keeping hairstyle/outfit/colors consistent — but the floating-window half-body form is the priority for this build.
2.2 2D Rigging Pipeline (built by Shoya, tools removed after use)
Layer separation: Split the source PNG into transparent-background parts (head/hair, eyebrows, eyes, eyelids, mouth shapes, torso, arms/hands) using an image-segmentation tool or manual layer prep script.
Rigging: Rig the parts using a 2D animation framework — recommended: Live2D Cubism (industry-standard for exactly this half-body, breathing/blinking/talking character use case; has built-in physics for hair sway and real-time lip-sync parameter binding) via the Cubism SDK for Web, rendered inside Electron on a WebGL canvas. Rive is an acceptable lighter-weight alternative if Cubism's editor/licensing is a blocker — Rive supports state-machine-driven 2D animation and runs natively in Electron with a small runtime footprint.
Parameter/bone setup: Bind rig parameters for: eye blink, eyebrow position, mouth shape (viseme set for lip-sync), head tilt/turn, arm position (idle / raised-point / wave / thumbs-up), subtle idle breathing sway, hair physics.
Export: Export the rigged model (.moc3 + textures for Cubism, or .riv for Rive) into D:\own-ai\characters\.
Tooling cleanup: Any GUI editor, segmentation tool, or one-off rigging script used only to produce these assets is a dev-time-only dependency — used once to produce the finished rig files, then removed from the project (uninstalled, removed from package.json/extensions list). The shipped app only ever plays the finished rig at runtime; it never re-rigs or edits character art live.
2.3 Floating Window Behavior
The floating window is the primary way LUNA/Shoya appear day-to-day — a small always-on-top window showing the half-body 2D character over a fully transparent background (true window transparency, not a solid-color placeholder — no visible box/frame behind the character; only the character and its UI elements like the subtitle bar should be visible against the desktop).
Required behavior:
True transparency: Electron transparent: true frameless window; the character floats directly over the desktop/other apps with no visible background panel behind it.
Idle animation loop: breathing motion, occasional blink, subtle head movement, hair sway — never a frozen static image.
Real-time lip-sync: mouth-shape parameter driven by TTS phoneme/viseme output while speaking.
Hand/arm gestures: point (toward a UI element or screen region), wave (hello/goodbye), thinking pose, thumbs-up on success — triggered contextually by the current state, not just decorative.
State-driven expression: Idle, Listening, Thinking, Speaking, Happy, Confused, Working, Coding, Searching, Explaining, Pointing, Waiting, Error, Success, Goodbye (same state list as before — now implemented via 2D rig parameters instead of 3D animation clips).
Subtitle/status bar: live caption of what's being said, plus a status line ("Listening...", "Thinking...", "Speaking...").
Voice waveform indicator while listening/speaking.
Window is: draggable, resizable, always-on-top toggle, click-through mode, and can be repositioned/resized by voice command ("move yourself to the right," "make yourself smaller," "put yourself in the bottom-right corner").
Smooth cross-fade/blend between animation states — no hard cuts or popping between poses.
2.4 Design System — Visual Aesthetic
Dark-mode-first, glass/neon-accented UI for the dashboard and settings surfaces surrounding the floating character (the floating window itself has no background panel per 2.3 — this palette applies to the dashboard, settings, chat panels, etc.):
Role
Color
Usage
Background base
#0A0A12 – #0D0D18
App shell, main canvas
Surface / panel
#14141F with 6–10% white glass overlay
Cards, side panels, chat bubbles
Border / divider
#2A2A3A (low opacity)
Card outlines, separators
Primary accent (LUNA)
Violet–magenta gradient #B24BF3 → #7B5CFA
LUNA's status indicators, active states
Secondary accent (Shoya)
Cyan–blue gradient #3AD1FF → #4C6FFF
Shoya's status indicators, active states
Success
#3DDC97
Success states, "Connected," completed tasks
Warning
#F5B942
Rate-limited, confirmation-required actions
Error
#FF5A6E
Error states, disconnected, failed actions
Text primary
#F2F2F7
Headings, body text
Text secondary
#9A9AB0
Captions, status labels, timestamps
Dark mode default; light mode secondary.
Glassmorphism panels (blur + soft glowing border in the active character's accent), rounded 8–12px corners, line-style icons, 8px spacing grid.
Smooth 150–250ms ease-in-out transitions throughout — panel open/close, AI switch, theme switch, navigation.
This design system applies to every non-floating-window screen: dashboard, settings, memory manager, project manager — one coherent product, not mismatched panels.
3. D:\own-ai\ Asset System
Code
Auto-create missing folders on first run; recursively scan existing content so nothing is lost or ignored. Asset manager in Settings shows detected models, 2D characters, voice assets, config, memory database, and projects — with reference art listed separately from loadable runtime assets. Allow manual reassignment of a character/asset to LUNA or Shoya.
4. AI Provider System
Unified provider system: Google Gemini, Anthropic Claude, OpenAI-compatible APIs, and local models via Ollama (standardized local backend — matches the existing Ollama-format model blobs; no separate GGUF/node-llama-cpp path). No hardcoded API keys — use Windows Credential Manager or encrypted config. Settings: Provider, API Key, Base URL, Model, Temperature, Max Tokens, System Prompt, Timeout, with a Test Connection button showing Connected / Disconnected / Invalid API Key / Rate Limited / Offline / Model Unavailable.
5. Offline-First Architecture
Code
Never repeatedly retry online requests while offline. Always show LUNA • OFFLINE / LUNA • ONLINE / Shoya • ONLINE clearly.
6. Long-Term Memory
Short-Term (current conversation), Session, Long-Term (preferences, projects, workflows), Project Memory (per workspace) — supports "Continue the project we worked on yesterday." Management UI: view, search, edit, delete, export, clear all, disable. Never secretly store sensitive information.
7. One-Week Session Expiration
Temporary sessions expire 7 days after creation unless explicitly saved; on expiration, delete conversation content, temp metadata, temp files/embeddings — never touch saved conversations, long-term memory, or project data. Settings: duration, auto-save toggle, ask-before-deleting toggle, expiration date shown in session manager.
8. Main Dashboard (Real Windows Application, Not a Website)
The dashboard is the full app surface: Chat, Projects, AI Models, Memory, Shoya, Research, Automation, Settings — built with genuine native-feeling Windows UI: proper window chrome, smooth transitions, glass/translucent panels per the design system (2.4), dark/light themes, keyboard shortcuts, responsive layout, system tray integration, Windows notifications, and correct minimize/maximize/close behavior. This is the area previous builds got wrong — layout must feel intentional and professional (per 2.4's spacing/typography/color rules), not a default Electron template with no visual design pass applied.
9. Floating AI Window
See Section 2.3 for full behavioral spec (transparency, lip-sync, gestures, state list). This is a separate, lightweight window from the main dashboard — it can be open on its own without the full dashboard running, and is the primary "always there" form of LUNA/Shoya.
10. Wake Word & Always-On Background Service
This is a core requirement the previous build did not deliver: the app must respond to its wake word without the user having to manually open anything first.
Architecture:
On Windows login (or on first launch, with an opt-in "Start with Windows" setting), a lightweight background process starts and stays resident — visible only as a system tray icon, no dashboard or floating window open by default.
This background process keeps a low-resource wake-word listener active continuously (push-to-talk is the v1 default input mode per user preference already on file, but the background service itself must always be running so that whichever input mode is active — push-to-talk hotkey or wake word — works without the user opening the app window first).
Saying "Luna" (or pressing the configured push-to-talk hotkey) while the app is running in the background causes the floating window (Section 2.3) to appear/animate in and become active — the user should never need to click a taskbar icon or open the dashboard just to talk to LUNA.
Example: "Luna, open VS Code" → LUNA's floating window appears, responds "Sure," and executes the action if permitted — all without the dashboard ever opening.
The dashboard only opens when explicitly requested (tray menu → Open Dashboard, or a voice command like "Luna, open the dashboard").
Settings: Wake Word ON/OFF, Sensitivity, Microphone selection, Push-to-Talk vs Always-Listening toggle, Start with Windows, Start minimized to tray.
The background service must be lightweight when idle — no 2D rig rendering, no dashboard rendering, and minimal CPU/RAM use until the wake word/hotkey fires or the user opens a window.
11. Voice Conversation
Code
Supports English, Hindi, Urdu, Hinglish with auto-detection and explicit language selection.
12. Interruptible Voice (Barge-In)
Code
Saying "Stop" halts speech immediately and enters listening mode — no waiting for the sentence to finish.
13. Windows Computer Control
Actions: open/close apps, focus windows, open/create folders, rename/move files, search/read files, create documents, start terminals, run approved commands, open websites, control supported apps, screenshots on request, explain what's on screen, guide the user through UI.
Permission tiers — Safe (open VS Code, open folder, create project file) vs Confirmation required (delete file, install software, run destructive commands, modify system settings). Never silently execute dangerous operations.
14. Visual Guidance System
Uses the 2D character's pointing gesture (Section 2.3): LUNA/Shoya analyzes the screen if permitted, identifies the UI element, plays the pointing animation with the character's arm/hand directed toward that area, shows an on-screen highlight/arrow overlay, and explains the action. "What do I do next?" continues the guided workflow.
15. VS Code Integration
Open VS Code, open a project/file, open terminal, navigate workspace, read project context, create/edit files, run dev commands, explain errors.
Code
16. Shoya Integration (Native Windows)
"Open Shoya for this project and continue" →
Identify current project
Open VS Code if necessary
Open the project directory (native Windows path)
Launch the configured Shoya CLI/interface directly on Windows
Use -c continuation flag when supported
Auto-detect the Shoya installation on Windows (PATH, known install directory, or the VS Code extension's registered command); allow manual command/path configuration in Settings if auto-detection fails. Do not assume a hardcoded executable path.
17. Exact Shoya Prompt Transmission
Code
Never modify the user's requested requirements without telling them. Show a visible activity log of this pipeline.
18. Coding Agent
Code
Supported languages: HTML, CSS, JavaScript, TypeScript, React, Next.js, Python, Java, C/C++, C#, Kotlin, Android, PHP, Node.js, SQL, Bash, PowerShell, and other configured languages. Available via both LUNA (offline-capable, Section 1) and Shoya (online specialist).
19. Research Assistant
Online: search → collect sources → compare → summarize → cite sources → speak summary.
Offline: search local documents → search indexed knowledge → use local model → state offline limitations clearly.
20. India-Specific News Mode
Priority order: India, Uttar Pradesh, Technology, Education, Science, AI, World, Business, Gaming, other user-selected topics. Supports filtered requests. Summarizes rather than reading full articles; clearly distinguishes live info from offline knowledge.
21. Project Manager
Each project: Name, Path, Description, Technology, Git Repository, Last Opened, Current AI, Recent Tasks, Project Memory. Buttons: Open, Continue, Open in VS Code, Open Terminal, Start Shoya, Ask LUNA, Project Memory.
22. AI Dashboard
Status panel for both AIs: online/offline state, model/provider, memory status, voice/language mode, current project/task — using the accent-color system from Section 2.4 so LUNA and Shoya remain instantly distinguishable.
23. Settings
General, AI, Voice, Character (LUNA rig file, Shoya rig file, idle animation set, speaking animation set, floating window size/transparency), Memory, Automation, and Paths (AI Root, Character/Memory/Projects Directory, Shoya executable, VS Code executable).
24. Security
Encrypted API credentials, Windows Credential Manager where possible, permission system, confirmation dialogs, action logs, tool sandboxing, no arbitrary destructive commands without confirmation, no hidden persistence, no credential logging, no API keys in source, safe error handling. Visible Activity Log of AI actions with timestamps.
25. System Tray
Since the app runs as a background service (Section 10), the tray icon is the primary "is LUNA running" indicator. Tray menu: Open Assistant (floating window), Pause/Enable Listening, Switch AI, Open Dashboard, Settings, Memory, Projects, Quit.
26. Global Commands
Natural commands including: open apps/projects, continue last project, start Shoya, explain errors, search/research, get news, switch language, stop, resize/reposition the floating window, ask what you're working on, remember/forget, switch between LUNA and Shoya, switch offline/online mode.
27. AI Brain / Orchestration Layer
Code
Router determines whether a task goes to: LUNA Local, LUNA Online, Shoya, Research Agent, Windows Tools, VS Code Tools, File Tools, or Memory System.
27.1 Explicit AI Switching
"Switch to Shoya" → Shoya becomes the active AI (his character appears in the floating window; his voice/personality handles responses) until switched back.
"Switch to Luna" / "Switch back to offline mode" → LUNA becomes active again.
The inactive AI stays available in the background (visible in the AI Dashboard) — switching only changes who's front-and-center by default.
Switching is instant, with a short transition animation and a spoken/text confirmation ("Switched to Shoya.").
The user can address either AI by name for a one-off response without changing the default active AI.
28. Personality
LUNA: kind, patient, intelligent, curious, calm, encouraging, slightly playful, honest about limitations, never pretends a failed action succeeded.
Shoya: focused, technical, practical, confident, developer-oriented, concise when coding, detailed when explaining architecture.
Personality is configurable without altering core safety behavior.
29. UI Animations
Character idle/breathing/blink loop, smooth window transitions, message animations, loading animations, AI thinking indicator, AI-switch animation, dashboard transitions, hover effects, button feedback, voice waveform, task progress animation — all driven by the 2D rig's parameter system (Section 2.2) rather than 3D animation clips.
30. Build & Deployment Architecture
Development is entirely Windows-native — no Linux/WSL layer anywhere in this pipeline.
30.1 Development Environment (Windows, VS Code + Shoya)
Development happens directly inside VS Code running natively on Windows, using Shoya as the coding agent (VS Code extension / CLI integration on Windows).
Stack: Electron for the native Windows app shell (system tray, notifications, transparent frameless windows, Credential Manager access) + Live2D Cubism SDK for Web (or Rive, per Section 2.2) rendered on a WebGL/Canvas layer inside Electron's renderer process for the 2D character.
Toolchain: Node.js LTS 20.x, npm/pnpm, Git for Windows, Visual Studio Build Tools (for native Node module compilation).
VS Code extensions: Shoya (coding agent), ESLint, Prettier, GitLens, Path Intellisense.
Do not commit local AI model weights, D:\own-ai\ contents, or the reference images to Git — .gitignore covers all of it. Repo contains source code, config schemas, and default/empty folder placeholders only.
30.2 Build & Release (GitHub Actions)
Installer built by a GitHub Actions workflow on windows-latest, triggered on tag push (e.g. v1.0.0).
Steps: checkout → setup-node → npm ci → npm run build → package with electron-builder --win → upload artifact → create GitHub Release with the installer attached.
The runner is a clean, ephemeral cloud VM — no D:\, no D:\own-ai\, no local models needed at build time.
Code-signing secrets, if used, live in GitHub Actions secrets — never hardcoded.
GitHub repo URL: pending — to be provided by the user before the first release workflow run. Placeholder: <REPO_URL_TBD>.
30.3 Runtime Environment (User's Windows PC)
The installed .exe reads D:\own-ai\ on the local disk at runtime — the only place this happens.
AI root path is configurable, not hardcoded: default D:\own-ai\, actual path stored in %APPDATA%\LUNA\config.json, changeable via first-run setup or Settings → Paths.
On first run, missing folders under the AI root are created automatically (Section 3) rather than failing.
If the configured path becomes missing/inaccessible later, show a clear "AI workspace not found" state and offer to re-select/recreate it — never crash silently.
No network dependency for local features — reading D:\own-ai\, running local models via Ollama, and accessing local memory must never require internet.
Code
31. Performance
2D rig rendering is lightweight compared to 3D — but still pause/unload the character canvas when the floating window is hidden and the dashboard is closed, leaving only the low-resource wake-word/hotkey listener active in the background service.
Do not load every local AI model into RAM simultaneously — load on demand via Ollama, unload unused models where possible.
Avoid unnecessary CPU usage during idle mode; GPU acceleration for the 2D canvas where available, with a low-performance fallback (reduced frame rate / simplified physics) on weaker laptops.
32. Extended Jarvis-Level Capabilities
These capabilities move LUNA from a reactive command-taker to a genuine always-on assistant that acts on your behalf, not just when directly asked.
32.1 Proactive Routines & Reminders
LUNA can act without being prompted in the moment, based on schedule or trigger conditions:
Time-based routines: e.g. a "Good morning" briefing at a configured time (weather, calendar for the day, unread priority items, yesterday's unfinished project task) delivered via the floating window, voice, or a dashboard card — user-configurable per routine.
Reminders: "Remind me to push the build in 2 hours" / "Every weekday at 9am, remind me to check the CI status" — one-off and recurring, stored in memory (Section 6), fired even if the dashboard isn't open (background service, Section 10).
Condition-based triggers (optional, opt-in): e.g. "Tell me when the build finishes" — LUNA watches a running task/process and proactively notifies on completion rather than requiring the user to ask.
Settings: enable/disable proactive mode entirely, per-routine enable/disable, quiet hours (no proactive voice interruptions during configured hours — notifications queue silently instead).
Proactive messages always go through the same permission model as any other action (Section 13) — no proactive execution of confirmation-required actions without asking first.
32.2 Calendar / Email / Clipboard Integration
Calendar: read upcoming events (for briefings, "what's next" queries, and scheduling conflict awareness when creating new events); create/modify events on request, always confirming details before writing.
Email: read/summarize inbox on request or in a briefing digest; draft replies for user review — LUNA never sends email autonomously without explicit confirmation (email send is a confirmation-required action per Section 13).
Clipboard: LUNA can read the current clipboard contents when explicitly asked ("summarize what I just copied," "explain this code I copied") and can write to the clipboard on request ("copy that for me"). Clipboard access is opt-in and never passively monitored/logged without the user invoking it.
These integrate via the same provider/permission architecture as other Windows actions — no new trust model, just new action types in the existing Safe/Confirmation-required tiers.
32.3 Action Self-Verification
Every action LUNA/Shoya performs (file creation, command execution, build trigger, sent message, etc.) must be verified, not assumed, before reporting success:
Code
Never say "Done" or "Created" without checking the result actually happened (e.g. confirm a file exists on disk after a "create file" action, check a process exit code after running a command).
On failure, report what specifically failed and why, and offer a next step (retry, try an alternative approach, or ask the user how to proceed) rather than silently giving up or claiming success.
This applies uniformly to LUNA's local actions and Shoya's coding actions — it's a core honesty requirement, not a per-feature one, and reinforces the existing personality rule ("never pretends a failed action succeeded," Section 28).
32.4 Speaker Recognition (Voice ID)
LUNA supports an opt-in voice enrollment step (record a short voice sample during setup) so the wake word only activates for the enrolled user's voice, reducing false activations from TV/other people speaking nearby.
If voice ID is enabled and an unrecognized voice says "Luna," the assistant does not activate (or activates in a restricted "guest" mode with no access to personal memory, automation, or confirmation-required actions — configurable).
This is a local, on-device voiceprint check — no voice data leaves the machine, and the user can disable voice ID entirely and fall back to open wake-word activation for anyone.
Settings: Enable/disable voice ID, re-enroll voice, guest-mode behavior when an unrecognized voice is detected.
32.5 Notification Digest on Return
When the dashboard/floating window is reopened (or the user returns after being away, detected via idle time or explicit "what did I miss?"), LUNA offers a short digest: completed background tasks, fired reminders, new proactive-routine outputs, and any errors/confirmations that are still pending the user's attention.
Digest is summarized, not a raw log dump — a few sentences plus an offer to go into detail ("Want the full activity log?").
Digest respects quiet-hours settings from Section 32.1 — it doesn't retroactively surface things as urgent that weren't flagged urgent when they happened.
32.6 Plugin / Skill System
To let capabilities grow later without touching core app code:
Define a skill/plugin interface — a structured folder/manifest format (e.g. D:\own-ai\skills\<skill-name>\manifest.json + implementation) describing: skill name, description, trigger intents/keywords, required permissions, and the action(s) it performs.
The AI Router (Section 27) checks installed skills alongside its built-in tool set when deciding how to handle a request — a new skill becomes available to LUNA/Shoya without a rebuild of the whole app, just a drop-in folder plus a restart or hot-reload of the skill registry.
Skill manifest declares its permission tier (Safe / Confirmation-required, per Section 13) up front — the app enforces this the same way it does for built-in actions; a skill cannot silently request elevated access.
Settings → Automation includes a Skills manager: list installed skills, enable/disable individually, view what permissions each one has requested.
32.7 Browser Automation
Beyond "open a website," LUNA/Shoya can control a browser session on request: open a specific page, navigate, fill and submit a form, extract/read page content, click a described element — using an automation layer (e.g. Playwright or a similar browser-automation library) driven from the same intent/action pipeline as other Windows actions.
Browser actions follow the same permission tiers: reading a page is Safe; submitting a form, logging in, or making a purchase is Confirmation-required.
The user can watch the automation happen (visible browser window) rather than it running fully headless/hidden, so it's always clear what LUNA is doing on their behalf.
32.8 Full Multi-Agent Orchestration ("Use All Agents As Needed")
For compound requests, LUNA should not be limited to one tool/agent per request — the orchestration layer (Section 27) must be able to chain multiple agents and tools within a single instruction:
Code
The router plans multi-step, multi-agent sequences from a single natural-language request rather than requiring the user to issue one command per tool.
Each sub-task still individually respects its own permission tier — a compound request doesn't bypass confirmation requirements for any step that needs one; LUNA asks for confirmation on the specific step that needs it and continues the rest of the sequence.
If one step in a chain fails, LUNA reports which step failed and what already succeeded, rather than reporting total success or total failure — consistent with Section 32.3.
This applies across every capability in this document — memory, coding (LUNA local or Shoya/OpenCode/API), Windows control, calendar/email, browser automation, research, and skills/plugins are all available to the same planner and can be combined in one request.
33. Resolved Decisions Log
Final decisions — proceed on this basis, do not re-ask:
Scope expansion confirmed: All of Section 32 (proactive routines, calendar/email/clipboard, action self-verification, speaker recognition, notification digest, plugin/skill system, browser automation, full multi-agent orchestration) is in scope for this build — not optional/future-only.
Shoya's backend model: Shoya is a persona that routes to multiple backends (OpenCode CLI + any configured API provider), not a single fixed tool — see Section 1.
Character rendering: 2D rigged characters (Live2D Cubism preferred, Rive as lighter-weight fallback) built from img1_nishimiya.png and img2_shoya.png. No 3D pipeline, no Babylon.js/Three.js, no procedural 3D model generation.
Rigging tooling lifecycle: Segmentation/rigging tools used to produce the character files are dev-time-only — removed from the project once D:\own-ai\characters\ contains the finished rig files.
Local inference backend: Ollama (matches existing Ollama-format model blobs); no separate GGUF/node-llama-cpp path.
Wake word / activation: Push-to-talk is the default input trigger, but the background service must always be running (tray-resident, starts with Windows if enabled) so the floating window can appear on wake word/hotkey without the user manually opening the app first. This was a gap in the previous build and is now a hard requirement (Section 10).
Floating window transparency: Must be true OS-level window transparency (no visible panel/box behind the character) — this was not correctly delivered previously and is now specified explicitly (Section 2.3).
GitHub repo URL: Still pending from the user.