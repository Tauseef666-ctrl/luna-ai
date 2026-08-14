# LUNA — Advanced Windows AI Companion

Build a fully functional Windows desktop EXE AI companion named "LUNA", designed as a real Windows application rather than a simple chatbot. LUNA should combine an offline local AI, an online AI coding companion named Shoya, 3D animated characters, voice interaction, memory, coding automation, research, Windows control, project management, and a futuristic assistant dashboard.

The application should be modular, reliable, secure, visually polished, and capable of working without an internet connection whenever an offline capability is available.

---

## 1. Core Concept

The application contains two primary AI personalities:

### LUNA — Offline AI

LUNA is the primary female AI companion.

She should have a gentle, friendly, intelligent, patient personality — warm, soft-spoken, and encouraging in tone. Use an original visual identity and voice; do not copy any existing copyrighted character's likeness, dialogue, or design.

The user already has LUNA's 3D assets:

`D:\own-ai\`

There are 5 different 3D models stored somewhere inside this directory along with their animations.

The application must automatically scan the "D:\own-ai\" directory and discover available models and animation files instead of hardcoding assumptions about filenames.

LUNA should primarily operate locally using available local AI models, automatically selecting an appropriate model depending on the task (conversation, coding, general assistance, summarization, reasoning, file understanding, offline research, computer guidance, project assistance), with automatic fallback if the preferred model is unavailable.

**LUNA has full coding capability offline.** She is not limited to conversation/assistance tasks — when offline (or when the user simply asks LUNA directly rather than Shoya), she can read, write, edit, refactor, and debug code using a local coding-capable model (e.g. a local code-tuned LLM such as a Code Llama/DeepSeek-Coder/Qwen-Coder class model detected in `D:\own-ai\models\`). She should be able to:
- Generate and edit files across the languages listed in Section 18
- Explain errors and suggest fixes using local project context
- Run approved terminal commands and interpret their output
- Continue an existing project's code without needing internet access

The difference between LUNA-offline-coding and Shoya is **capability tier and context**, not availability: Shoya is the specialized, typically-online, heavier-duty coding agent best suited for larger multi-file builds, architecture-level work, and long coding sessions, while LUNA's local coding ability is always available (even with no internet) for everyday edits, quick fixes, explanations, and continuing work when Shoya isn't invoked or isn't reachable. The user can code with LUNA alone indefinitely if they choose never to invoke Shoya.

### Shoya — Online Coding AI

A second switchable AI called **Shoya** — an online-capable male coding assistant with a focused, determined, technical personality. Use an original identity, appearance, dialogue, and personality.

Shoya has its own 3D model and animations located inside `D:\own-ai\`, auto-detected by the app.

Shoya specializes in: programming, software development, debugging, Git, GitHub workflows, VS Code, Windows Terminal/PowerShell commands, project architecture, code generation, refactoring, testing, documentation, build systems, and DevOps-style tasks (including GitHub Actions workflows).

---

## 2. Visual & 3D Character Design Reference

This section defines exactly how LUNA and Shoya should look and behave visually, based on the reference concept art: a **floating half-body window view** and a **full-body dashboard view** for each character.

### 2.1 Floating Window — Half-Body Portrait View

Both LUNA and Shoya appear in their own small floating window, framed like a portrait cut off at the chest/upper-torso (half-body, facing forward, resting arms on the bottom edge of the window as if leaning on a windowsill/frame). This framing directly matches the two half-body reference images stored at `D:\own-ai\reference\img1.png` (LUNA reference) and `D:\own-ai\reference\img2.png` (Shoya reference) — the finished rigged 3D models loaded into the floating window should match the pose, framing, and windowsill-lean composition shown in those two reference images.

**LUNA (floating window, per `img1`):**
- Half-body, arms crossed/resting gently at the base of the frame, one hand near her chin in a soft, thoughtful pose during idle/listening states
- Long hair with idle physics-based sway (subtle wind/breathing motion, not static)
- Soft ambient lighting, warm neutral background so she reads clearly in a small window
- Expression shifts smoothly between calm/neutral, soft smile, and attentive-listening

**Shoya (floating window, per `img2`):**
- Half-body, same resting-arms-on-frame pose language for visual consistency with LUNA, but posture reads more upright/alert
- Short, spiky dark hair with light idle motion
- Neutral-to-focused expression, occasional confident half-smile when a task completes

**Shared floating-window behavior:**
- Real-time **lip-sync** driven by TTS phoneme/viseme output whenever speaking
- Subtitle/caption bar under the character showing live text of what's being said
- Status line ("Listening...", "Thinking...", "Speaking...", "Working...")
- Voice waveform indicator animating while listening or speaking
- Small toolbar (mic toggle, share, settings) docked at the bottom of the window
- Window is: always-on-top (toggle), resizable, draggable, transparent/glass background option, click-through mode
- Idle breathing/blink loop when no state is active, so the character never looks frozen

### 2.2 Dashboard — Full-Body Character View

The main dashboard shows LUNA and Shoya as **full-body 3D characters** standing on a glowing status platform/ring (color-coded per character — e.g., soft accent ring under LUNA, cool accent ring under Shoya), each next to a live status card. This view matches the two full-body reference images stored at `D:\own-ai\reference\img3full.png` (LUNA) and `D:\own-ai\reference\img4full.png` (Shoya) — the finished rigged 3D models used on the dashboard should match the standing pose, proportions, and outfit silhouette shown in those two reference images.

**Full-body pose & gesture set (both characters):**
- Neutral standing idle with natural weight shift and breathing motion
- Wave hello / wave goodbye gesture
- Open-palm "presenting" gesture when explaining something
- Thinking pose (hand near chin/head)
- Arms crossed during passive listening
- **Pointing gesture** — arm extended, finger indicating a specific UI element, screen region, or direction ("point at screen elements," "point to the terminal," "point to an error line")
- Thumbs-up / OK gesture on success
- Full-body lip-sync + facial expression layered on top of any pose (talking while pointing, talking while gesturing, etc.)

**Live status card next to each character shows:**
- Online/Offline state
- Current model or provider in use
- Memory status (enabled/active)
- Voice/language mode
- Current mood/expression state
- Current task ("Ready to assist...", "Building UI...", etc.)

**Supporting animation state library (applies to both floating-window and full-body forms):**

| State | Behavior |
|---|---|
| Idle | Breathing loop, occasional blink, subtle head movement |
| Listening | Head tilt toward mic, waveform active, attentive expression |
| Thinking | Hand-to-chin or eyes-up pose, subtle processing motion |
| Speaking | Full lip-sync, natural hand gestures synced to speech emphasis |
| Happy | Brighter expression, small bounce or smile animation |
| Confused | Head tilt, questioning expression, slight shrug |
| Working | Focused expression, typing/tool-use gesture |
| Coding | Shoya-specific: looking at a virtual screen, occasional pointing at code |
| Searching | Eyes scanning, slight forward lean |
| Explaining | Open-palm gestures, pointing toward the relevant UI region |
| Pointing | Directed arm/finger animation toward a specific coordinate/element, with an on-screen highlight/arrow overlay |
| Waiting | Relaxed idle, occasional glance toward the user |
| Error | Concerned expression, subtle apologetic gesture — never a fake "success" animation |
| Success | Thumbs-up or small celebratory gesture, confirmation chime-synced |
| Goodbye | Wave animation, fade or walk-off transition |

**Technical requirements:**
- Real-time lip-sync via viseme mapping from the TTS engine (not pre-baked)
- Skeletal rig supporting arm/hand IK so pointing gestures can target arbitrary screen coordinates dynamically
- Smooth blending/cross-fade between animation states (no hard cuts)
- Facial expression blendshapes layered independently from body animation
- Both the half-body (floating window) and full-body (dashboard) views must share the same underlying rig/model so behavior is consistent across views, just framed differently
- Renderer suitable for Windows desktop (Unity, Unreal, Godot, or a native WebView/WebGL-based renderer), GPU-accelerated with a low-performance fallback mode

Do not replace the user's existing models unnecessarily — this section governs *behavior and animation*, not asset replacement.

### 2.3 Reference Art Assets — Definitive Visual Target

Four reference images are stored inside `D:\own-ai\reference\`:

| File | Character | Framing | Used for |
|---|---|---|---|
| `img1_nishimiya.png` | LUNA | Half-body | Floating-window pose/framing (Section 2.1) |
| `img2_shoya.png` | Shoya | Half-body | Floating-window pose/framing (Section 2.1) |
| `img3_nishimiya_full.png` | LUNA | Full-body | Dashboard pose/proportions (Section 2.2) |
| `img4_shoya_full.png` | Shoya | Full-body | Dashboard pose/proportions (Section 2.2) |

These four images are the **definitive visual target** for the generated 3D models (Section 32.1) — not loose mood-board inspiration. When Shoya runs the model-generation pipeline, it should match these references as closely as the tooling allows for: hairstyle/color, outfit, build, and face shape, while producing an **original character design** (do not treat this as reproducing any specific existing copyrighted character — the generated models should read as LUNA's and Shoya's own original look, built using these images purely as a local styling reference).

- `img1_nishimiya.png` / `img2_shoya.png` → drive the character's appearance in the **floating window** (Section 2.1): half-body, resting on the window frame, idle sway, lip-sync, listening/thinking/speaking states.
- `img3_nishimiya_full.png` / `img4_shoya_full.png` → drive the character's appearance in the **dashboard full-body view** (Section 2.2): standing on the status ring, full gesture set (wave, point, thinking pose, thumbs-up, etc.), full-body lip-sync.
- Both framings (half-body and full-body) must render from the **same underlying rigged model** per character — the reference images describe two camera framings of one consistent design, not two different characters.

These are **static design reference only** — never loaded as runtime assets, rigged directly, or displayed as-is inside the app; the actual runtime characters are the 3D rigged models generated per Section 32.1 and stored in `D:\own-ai\models\`/`characters\`. The asset manager (Section 3) should detect and list this reference folder separately from usable model/animation assets so it's clear which files are "look reference" vs. "loadable assets."

### 2.4 Design System — Visual Aesthetic

The overall UI should match a premium, futuristic AI-companion look — dark, glassy, and neon-accented, consistent with the dashboard reference concept — not a generic flat admin panel.

**Theme mode:**
- Dark mode is the default and primary theme; light mode is a secondary option, not the design focus.
- No pure black/pure white — use deep near-black/navy backgrounds and soft off-white text for comfortable contrast.

**Color palette (dark mode):**

| Role | Color | Usage |
|---|---|---|
| Background base | `#0A0A12` – `#0D0D18` | App shell, main canvas |
| Surface / panel | `#14141F` with 6–10% white glass overlay | Cards, side panels, chat bubbles |
| Border / divider | `#2A2A3A` (low opacity) | Card outlines, separators |
| Primary accent (LUNA) | Violet–magenta gradient `#B24BF3 → #7B5CFA` | LUNA's status ring, active states, her chat bubble accents |
| Secondary accent (Shoya) | Cyan–blue gradient `#3AD1FF → #4C6FFF` | Shoya's status ring, active states, his chat bubble accents |
| Success | `#3DDC97` | Success animation states, "Connected," completed tasks |
| Warning | `#F5B942` | Rate-limited, confirmation-required actions |
| Error | `#FF5A6E` | Error states, disconnected, failed actions |
| Text primary | `#F2F2F7` | Headings, body text |
| Text secondary | `#9A9AB0` | Captions, status labels, timestamps |

**Glass / depth effects:**
- Panels use subtle background blur (acrylic/glassmorphism) with a soft 1px glowing border matching the active character's accent color.
- Floating character windows and status rings have a soft outer glow (bloom) in their accent gradient — not a hard drop shadow.
- Avoid heavy skeuomorphism; keep surfaces mostly flat with glow/blur for depth rather than gradients-on-everything.

**Typography:**
- A clean geometric sans-serif for UI chrome (e.g. Inter, Segoe UI Variable, or similar system-native font) for readability and native Windows feel.
- Headings: medium-bold weight, slightly larger tracking for section titles ("LUNA AI ASSISTANT" style headers).
- Body/chat text: regular weight, comfortable line height for reading long responses.
- Status labels/badges: small caps or uppercase, letter-spaced, in the secondary text color.

**Iconography & buttons:**
- Line-style icons (not filled/skeuomorphic), thin stroke weight, consistent sizing across the sidebar and toolbars.
- Buttons: rounded corners (8–12px radius), subtle hover glow in the relevant accent color, pressed state slightly dims rather than jumping in size.
- Status dots (● ONLINE / ● OFFLINE) use solid accent/success/error colors with a soft glow, not flat icons.

**Layout rhythm:**
- Consistent 8px spacing grid across dashboard cards, sidebar, and floating windows.
- Sidebar navigation stays fixed-width, icon+label, with the active item highlighted by a left accent bar + soft background tint in the current character's gradient.
- Dashboard status rings/platforms (Section 2.2) anchor each character visually and should use their respective accent gradient consistently across every screen they appear on (dashboard, floating window border, status badges) so LUNA and Shoya remain instantly distinguishable at a glance.

**Motion:**
- All transitions (panel open/close, theme switch, AI switch, page navigation) use smooth ease-in-out easing, ~150–250ms — snappy, not sluggish, and never abrupt/jarring.
- Avoid gratuitous motion — animations should communicate state change, not decorate for its own sake.

This design system applies across the main dashboard, floating windows, settings, memory manager, project manager, and every other screen — the app should feel like one coherent product, not a set of mismatched panels.

---

## 3. D:\own-ai\ Asset System

Make "D:\own-ai\" the configurable AI workspace. The application should detect:

```
D:\own-ai\models\
D:\own-ai\characters\
D:\own-ai\animations\
D:\own-ai\voices\
D:\own-ai\projects\
D:\own-ai\memory\
D:\own-ai\config\
```

If these folders don't exist, create them. Also recursively scan the existing `D:\own-ai\` directory so existing assets are not lost or ignored.

Create an asset manager inside Settings showing detected models, 3D characters, animations, voice assets, AI model files, configuration, memory database, and projects. Allow the user to manually assign a model/asset to LUNA or Shoya.

---

## 4. AI Provider System

Unified AI provider system supporting Google Gemini, Anthropic Claude, OpenAI-compatible APIs, local LLMs, Ollama, LM Studio, Shoya-compatible interfaces, and other OpenAI-compatible endpoints. Do not hardcode API keys — use secure Windows credential storage or encrypted configuration.

Settings allow entering: Provider, API Key, Base URL, Model, Temperature, Maximum Tokens, System Prompt, Timeout. Provide a Test Connection button showing Connected / Disconnected / Invalid API Key / Rate Limited / Offline / Model Unavailable.

---

## 5. Offline-First Architecture

```
Internet available
        ↓
Use configured online provider when appropriate
        ↓
Internet unavailable
        ↓
Automatically switch to local model
        ↓
Continue conversation
```

Never repeatedly attempt online requests when offline. Clearly display: `LUNA • OFFLINE`, `LUNA • ONLINE`, `Shoya • ONLINE`.

---

## 6. Long-Term Memory

Short-Term (current conversation), Session, Long-Term (preferences, projects, workflows), and Project Memory (per workspace). Must support queries like *"Continue the project we worked on yesterday."*

Management interface: view, search, edit, delete, export, clear all, disable memory. Never secretly store sensitive information.

---

## 7. One-Week Session Expiration

Temporary sessions expire 7 days after creation unless explicitly saved. On expiration: delete conversation content, temporary metadata, temp files, temp embeddings/indexes. Never delete saved conversations, long-term memory, or project data.

Settings: Temporary Session Duration, Auto-save important conversations, Ask before deleting. Show expiration date in the session manager.

---

## 8. Real Windows Application Interface

Main Dashboard layout hosts the **full-body 3D character view** described in Section 2.2, plus navigation: Chat, Projects, AI Models, Memory, Shoya, Research, Automation, Settings.

Modern Windows design: smooth transitions, glass/translucent elements, dark/light themes, subtle animations, keyboard shortcuts, responsive layout, system tray support, Windows notifications, proper minimize/maximize/close behavior.

---

## 9. Floating AI Window

Implements the **half-body portrait view** described in Section 2.1: always-on-top toggle, movable, resizable, transparent, click-through mode, subtitles, listening/thinking/speaking status, current task display.

Voice commands: *"Luna, move yourself to the right,"* *"Make the window smaller,"* *"Put yourself in the bottom-right corner,"* *"Make yourself transparent,"* *"Stay above my other windows."*

---

## 10. Wake Word

Say "Luna" to activate. Example: *"Luna, open VS Code"* → *"Sure."* → executes if permitted. Settings: Wake Word ON/OFF, Sensitivity, Microphone, Push-to-Talk, Always Listening.

---

## 11. Voice Conversation

```
Microphone → Speech Recognition → Intent Detection → AI Reasoning
→ Action / Response → Text-to-Speech → 3D Lip Sync + Animation
```

Supports English, Hindi, Urdu, Hinglish with auto-detection and explicit language selection.

---

## 12. Interruptible Voice (Barge-In)

```
LUNA speaking → User speaks → Detect speech → Stop/duck TTS
→ Listen to user → Understand new request → Respond
```

Saying *"Stop"* immediately halts speech and enters listening mode — no waiting for sentence completion.

---

## 13. Windows Computer Control

Actions: open/close apps, focus windows, open/create folders, rename/move files, search/read files, create documents, start terminals, run approved commands, open websites, control supported apps, screenshots on request, explain what's on screen, guide the user through UI.

Permission tiers — **Safe** (open VS Code, open folder, create project file) vs **Confirmation required** (delete file, install software, run destructive commands, modify system settings). Never silently execute dangerous operations.

---

## 14. Visual Guidance System

Uses the **Pointing** animation state (Section 2.2): LUNA/Shoya analyzes the screen (if permitted), identifies the UI element, moves the character/points toward that area, displays an on-screen arrow/highlight, and explains the action. User can say *"What do I do next?"* to continue the guided workflow.

---

## 15. VS Code Integration

Open VS Code, open a project/file, open terminal, navigate workspace, read project context, create/edit files, run dev commands, explain errors.

```
Find project → Open VS Code → Open workspace → Load project context
→ Ask whether to continue with Shoya
```

---

## 16. Shoya Integration (Native Windows)

*"Open Shoya for this project and continue"* →
1. Identify current project
2. Open VS Code if necessary
3. Open the project directory (native Windows path)
4. Launch the configured Shoya CLI/interface directly on Windows
5. Use `-c` continuation flag when supported

Auto-detect the Shoya installation on Windows (e.g. via PATH, a known install directory, or the VS Code extension's registered command); allow manual command/path configuration in Settings if auto-detection fails. Do not assume a hardcoded executable path.

---

## 17. Exact Shoya Prompt Transmission

```
LUNA → Understanding request → Preparing Shoya instruction
→ Sending instruction → Shoya working → Result received
```

Never modify the user's requested requirements without telling them.

---

## 18. Coding Agent

```
Current project → Project files → Git status → Recent changes
→ Existing architecture → Current task
```

Supported languages: HTML, CSS, JavaScript, TypeScript, React, Next.js, Python, Java, C/C++, C#, Kotlin, Android, PHP, Node.js, SQL, Bash, PowerShell, and other configured languages.

---

## 19. Research Assistant

**Online:** search → collect sources → compare → summarize → cite sources → speak summary.
**Offline:** search local documents → search indexed knowledge → use local model → state offline limitations clearly.

---

## 20. India-Specific News Mode

Priority order: India, Uttar Pradesh, Technology, Education, Science, AI, World, Business, Gaming, other user-selected topics. Supports filtered requests (*"Give me only India news"*, *"Uttar Pradesh news"*). Summarizes rather than reading full articles; clearly distinguishes live info from offline knowledge.

---

## 21. Project Manager

Each project: Name, Path, Description, Technology, Git Repository, Last Opened, Current AI, Recent Tasks, Project Memory. Buttons: Open, Continue, Open in VS Code, Open Terminal, Start Shoya, Ask LUNA, Project Memory.

---

## 22. AI Dashboard

Status panel per Section 2.2's status card design, showing both AI systems' online/offline state, model/provider, memory, voice, and current project/task at a glance.

---

## 23. Settings

General, AI, Voice, **Character** (LUNA model, Shoya model, animation set, idle animation, speaking animation, transparency, floating window size), Memory, Automation, and Paths (AI Root, Model/Character/Memory/Projects Directory, Shoya executable, VS Code executable).

---

## 24. Security

Encrypted API credentials, Windows Credential Manager where possible, permission system, confirmation dialogs, action logs, tool sandboxing, no arbitrary destructive commands without confirmation, no hidden persistence, no credential logging, no API keys in source, safe error handling. Visible Activity Log of AI actions with timestamps.

---

## 25. System Tray

Tray menu: Open Assistant, Pause/Enable Listening, Switch AI, Open Dashboard, Settings, Memory, Projects, Quit.

---

## 26. Global Commands

Natural commands including: open apps/projects, continue last project, start Shoya, explain errors, search/research, get news, switch language, stop, resize/reposition the floating window, ask what you're working on, remember/forget, switch between LUNA and Shoya or offline/online modes.

---

## 27. AI Brain / Orchestration Layer

```
User Input → Wake Word / UI → Speech-to-Text → Intent Detection
→ Context + Memory → Task Planner → AI Router → Tool Selection
→ Permission Check → Action → Result → AI Response
→ TTS + Character Animation
```

Router determines whether a task goes to: LUNA Local, LUNA Online, Shoya, Research Agent, Windows Tools, VS Code Tools, File Tools, or Memory System.

### 27.1 Explicit AI Switching

The user can directly control which AI is "active" (i.e. who responds by default, whose character is front-and-center in the dashboard/floating window, and whose voice/personality handles the next messages) using direct commands:

- *"Luna, switch to Shoya"* / *"Switch to Shoya"* → Shoya becomes the active AI. His character (half-body/full-body view, accent color, status ring) becomes primary in the UI; his personality and voice handle subsequent responses until switched back.
- *"Shoya, switch to Luna"* / *"Switch to Luna"* / *"Switch back to offline mode"* → LUNA becomes the active AI again.
- The inactive AI is not shut down — both remain available in the background (e.g. via the AI Dashboard, Section 22), but only the active one is the default responder and the one shown prominently in the floating window.
- Switching is instant and confirmed verbally/visually (e.g. a short transition animation per Section 29, plus a spoken/text confirmation such as *"Switched to Shoya."*).
- The user can also address either AI by name directly without a formal "switch" command (e.g. asking Shoya a coding question mid-conversation with LUNA) for a one-off response, without changing which AI is the default active one.

---

## 28. Personality

**LUNA:** kind, patient, intelligent, curious, calm, encouraging, slightly playful, honest about limitations, never pretends a failed action succeeded.

**Shoya:** focused, technical, practical, confident, developer-oriented, concise when coding, detailed when explaining architecture.

Personality is configurable without altering core safety behavior.

---

## 29. UI Animations

Character idle animation, smooth window transitions, message animations, loading animations, AI thinking indicator, model-switching animation, dashboard transitions, hover effects, button feedback, voice waveform, task progress animation — all matched to the lip-sync/gesture/pointing system defined in Section 2.2.

---

## 30. Build & Deployment Architecture

This section governs how the application is developed, built, and distributed, and must be followed exactly so build-time and run-time environments never get conflated. Development is entirely Windows-native — no Linux/WSL layer is involved anywhere in this pipeline.

### 30.1 Development Environment (Windows, VS Code + Shoya)

- Development happens directly inside **VS Code running natively on Windows**, using **Shoya** as the coding agent (installed as a VS Code extension / CLI integration on Windows, not via WSL).
- Recommended stack: **Electron** (preferred for native Windows control — system tray, notifications, Windows Credential Manager access via npm packages) with **Babylon.js** for the 3D character rendering layer (final choice — see Section 32.4). Tauri is an acceptable lighter-weight alternative to Electron if Rust-based native modules are preferred, but Electron is the default assumption for this spec.
- Toolchain installed directly on Windows: Node.js LTS 20.x, `npm`/`pnpm`, Git for Windows, and Visual Studio Build Tools (for any native Node module compilation).
- **VS Code extensions to install:**
  - Shoya (coding agent integration)
  - ESLint
  - Prettier
  - GitLens
  - Path Intellisense
  - (If Tauri is chosen instead of Electron) the official Tauri extension + `rustup` for Windows
- Since development happens on the same OS the app targets, dev-mode runs (hot reload, tray, Credential Manager, `D:\` drive access, notifications) behave identically to the packaged build — no cross-platform emulation gap to account for.
- Do not commit local AI model weights (GGUF, safetensors, ONNX, etc.), the `D:\own-ai\` folder contents, or any of the 4 reference images into the Git repository. Add them to `.gitignore`. The repository should contain only source code, config schemas, and default/empty folder placeholders.

### 30.2 Build & Release (GitHub Actions)

- The installer is built by a GitHub Actions workflow running on a `windows-latest` runner, triggered on tag push (e.g. `v1.0.0`).
- Workflow steps: checkout → setup-node → `npm ci` → `npm run build` → package with `electron-builder --win` (or `tauri build`) → upload the build artifact → create a GitHub Release with the installer attached.
- The `windows-latest` runner is a clean, ephemeral cloud VM — separate from your local dev machine. It has **no D: drive, no `D:\own-ai\`, and no local AI models** — none of that is needed at build time, since the build only compiles and packages the application code itself.
- Only add signing secrets to the workflow if code-signing is required; otherwise the workflow needs no external credentials.
- Releases are versioned and attached as downloadable installers on the GitHub Releases page.

### 30.3 Runtime Environment (User's Windows PC)

- Once the released installer is downloaded and run on the actual Windows machine, **that** is when the app reads from `D:\own-ai\` on the local disk — scanning models, characters, animations, voices, memory, config, and the reference images described in Section 2.3.
- The AI root path must be **configurable, not hardcoded**: default to `D:\own-ai\`, but store the actual path in a local config file (e.g. `%APPDATA%\LUNA\config.json`) that the user can change during first-run setup or in Settings → Paths.
- On first run, if `D:\own-ai\` (or the configured path) does not exist, the app creates the full expected folder structure automatically (per Section 3) rather than failing.
- If the configured path is missing or inaccessible at any later point, the app must fail gracefully — show a clear "AI workspace not found" state in the dashboard and offer to re-select or recreate the folder, never crash silently.
- No network dependency for local features: reading `D:\own-ai\`, running local models, and accessing local memory must never require internet access.

Full pipeline:

```
Windows PC — VS Code + Shoya (write & test code)
        ↓ git push (tag)
GitHub Actions on windows-latest (builds LUNA-Setup.exe)
        ↓ release artifact attached to GitHub Release
User downloads & installs LUNA-Setup.exe on their Windows PC
        ↓ first run
App reads local config → resolves AI root path → scans D:\own-ai\
→ loads local models, characters, animations, memory, reference assets
```

Summary of the two-environment boundary:

| Environment | Purpose | Has access to `D:\own-ai\`? |
|---|---|---|
| Local Windows dev machine (VS Code + Shoya) | Write/test code, run in dev mode | Yes, but code must still treat the path as configurable, not assume a specific machine |
| GitHub Actions (CI) | Package the Windows installer | No — fresh empty VM, code/build artifacts only |

The installed `.exe` on any end-user's Windows PC (including your own, post-install) is the only place `D:\own-ai\` is read/written at runtime by the packaged app.

---

## 31. Performance

- Do not load every AI model into RAM simultaneously — load on demand, unload unused models where possible
- Pause 3D rendering when minimized
- Avoid unnecessary CPU usage during idle mode
- Use GPU acceleration when available; allow a low-performance mode
- Allow 3D rendering quality to scale down automatically on lower-spec laptops

---

## 32. Resolved Decisions Log

These decisions are final for this build and OpenCode should implement against them directly rather than re-asking.

**32.1 — 3D Character Assets (no existing models yet, Shoya generates them)**
No 3D models currently exist and the user will not be manually building them in external apps. Shoya generates the 5 LUNA models + 1 Shoya model itself, as part of the build process, using tooling invoked through VS Code/CLI, **using the four reference images in `D:\own-ai\reference\` (Section 2.3) as the visual target** for hairstyle/color, outfit, build, and face shape:
- **Approach:** Use an automated avatar-generation pipeline — e.g. a procedural/parametric humanoid generator (such as Ready Player Me's API/SDK, or a VRM-generation library) combined with Mixamo's auto-rigger and animation library, driven via scripts/CLI calls rather than manual GUI work — to produce finished `.vrm`/`.glb` character files and retargeted animation clips. Use `D:\own-ai\reference\img1.png`/`img3full.png` (LUNA) and `img2.png`/`img4full.png` (Shoya) — see Section 2.3 — as the visual target for hairstyle, outfit silhouette, and proportions when configuring the generator, not as literal textures to import.
- **Tooling lifecycle:** Any packages, CLIs, or VS Code extensions installed purely to generate these assets (rigging scripts, model-generation SDKs, Mixamo download/convert tools, etc.) are **dev-time-only dependencies** — install them, run the generation pass, export finished files into `D:\own-ai\models\` and `D:\own-ai\animations\`, then **uninstall/remove them from the project** (`package.json`, extension list, temp scripts) once assets are produced. They must not ship inside the final packaged `.exe` or remain as runtime dependencies.
- **Fallback:** Until asset generation is complete, the app still needs to run end-to-end — use a simple placeholder rig (primitive humanoid with blendshape facial expressions and basic arm IK) so the full animation/lip-sync/pointing pipeline (Section 2) is testable before final character art exists.
- **Asset loading stays generic:** The app's auto-scan asset system (Section 3) must not hardcode which generation method produced a file — it should simply load whatever valid character/animation files it finds in `D:\own-ai\`, falling back to the placeholder only if none exist. This keeps the door open to swapping in hand-made models later without code changes.

**32.2 — Local Model Runtime: Ollama (not raw GGUF loading)**
Since existing local models are Ollama-format blobs, the app integrates with **Ollama's local REST API** (`http://localhost:11434`) as the primary local inference path — do not reimplement GGUF quantized inference in-app. `node-llama-cpp`/direct GGUF loading is out of scope for v1; it may be added later as an optional secondary path for users without Ollama installed.

**32.3 — Wake Word: Push-to-Talk default, "Hey Luna" as a later addition**
Do not reuse "hey jarvis" wake-word assets — that is a differently-trained keyword model and won't recognize "Luna." V1 defaults to **push-to-talk**. A true "Hey Luna" wake word is a stretch-goal addition using **Picovoice Porcupine's free console** to train a custom keyword file for "Luna," rather than training a wake-word model from scratch.

**32.4 — Renderer: Babylon.js (not Three.js)**
Given the amount of animation blending, IK-driven pointing, and glTF/VRM avatar loading required by Section 2, use **Electron + Babylon.js**. Babylon's higher-level built-in support for character rigs, animation groups, and avatar loading reduces custom plumbing versus Three.js's lower-level API.

**32.5 — GitHub Repository**
*Pending* — the user will create the GitHub repository and provide the URL. Once provided, it should be recorded here and referenced by the Section 30.2 GitHub Actions workflow (`git remote`, release target, etc.).
