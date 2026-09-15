import type { AnimationClip, Object3D } from 'three'
import type { CharState } from '../shared/types'

// ---------------------------------------------------------------------------
// LUNA 3D Avatar Engine — shared contract.
// Owned by the coordinator. Do not change without flagging both agent plans.
// ---------------------------------------------------------------------------

export type AvatarQuality = 'low' | 'balanced' | 'high'

export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'confused'
  | 'surprised'
  | 'sad'
  | 'thinking'
  | 'listening'
  | 'speaking'
  | 'error'
  | 'success'

export type AvatarGesture =
  | 'wave'
  | 'nod'
  | 'shake'
  | 'point'
  | 'greeting'
  | 'think'
  | 'celebrate'
  | 'acknowledge'

// Semantic clip names the engine understands. animation-map maps these to
// real GLB clip names for whatever model is loaded.
export type SemanticClip =
  | 'idle'
  | 'breathing'
  | 'standing'
  | 'sitting'
  | 'walking'
  | 'turning'
  | 'waving'
  | 'pointing'
  | 'nodding'
  | 'headshake'
  | 'greeting'
  | 'thinking'
  | 'working'
  | 'listening'
  | 'speaking'
  | 'success'
  | 'error'
  | 'attention'

// For each semantic clip, an ordered list of candidate real clip names.
export interface ClipMap {
  [semantic: string]: string[]
}

export interface CharacterAvatarConfig {
  model: string // asset name in <aiRoot>/characters ('' = use procedural)
  clipMap: ClipMap
  idle: string[] // semantic clips cycled while idle (default: ['idle'])
  accent: string // hex accent color for environment lighting/rim
}

// Top-level avatar settings stored in LunaConfig (owner: Core).
export interface AvatarConfig {
  enabled: boolean
  quality: AvatarQuality
  procedural: boolean // build the procedural avatar when no GLB is selected
  eyeBlink: boolean
  idleBehavior: boolean
  lookAtUser: boolean
  lidScale: number // 0..1 overall blink strength
  speechEnergy: number // amplitude -> mouth/jaw sensitivity (0..2, default 1)
  expressionSmoothing: number // 0..1 cross-fade speed for expressions
  characters: { luna: CharacterAvatarConfig; shoya: CharacterAvatarConfig }
}

export interface AvatarStatus {
  available: boolean
  reason: 'ok' | 'no-webgl' | 'no-model' | 'load-error' | 'disabled'
  quality: AvatarQuality
  fps: number
  procedural: boolean
  model: string
  animations: number
  morphTargets: number
}

export type AvatarEvent =
  | { kind: 'load'; status: AvatarStatus }
  | { kind: 'quality-changed'; quality: AvatarQuality }
  | { kind: 'fps'; fps: number }
  | { kind: 'unavailable'; reason: AvatarStatus['reason'] }

// Procedural + best-effort bone hooks every controller drives through.
export interface AvatarRigHandles {
  head: Object3D | null
  jaw: Object3D | null
  eyeL: Object3D | null
  eyeR: Object3D | null
  armL: Object3D | null
  armR: Object3D | null
  spine: Object3D | null
  eyeLidL: Object3D | null
  eyeLidR: Object3D | null
}

// What a loaded model must guarantee the engine can drive.
export interface AvatarModel {
  readonly id: string // 'procedural' or the glb file name
  readonly isProcedural: boolean
  readonly root: Object3D // added to the scene
  readonly clips: AnimationClip[] // GLB clips (empty for the procedural model)
  readonly morphTargetNames: string[] // GLB morph targets (empty for procedural)
  readonly rig: AvatarRigHandles // bone hooks (procedural always fills; GLB best-effort)
  lookupClip(semantic: string): AnimationClip | null // resolves via clipMap
  getMorphTarget(name: string): number // current weight, 0 if unsupported
  setMorphTarget(name: string, value: number): boolean
  setVisibility(v: boolean): void
  dispose(): void
}

export interface AvatarLayerState {
  base: CharState
  gesture: AvatarGesture | null
  expression: AvatarExpression
  speech: number // 0..1 cumulative (lipsync + tts level)
  blink: number // 0..1 eyelid close
}

// Semantic animation request coming from AI (validated before execution).
export interface SemanticRequest {
  expression?: AvatarExpression
  gesture?: AvatarGesture
  state?: CharState
  source: 'ai' | 'ui' | 'system'
}

// Quality presets per level (used by the renderer + performance manager).
export interface QualityPreset {
  pixelRatio: number
  shadows: boolean
  shadowMapSize: number
  antialias: boolean
  particles: boolean
  bloom: boolean
  acceptableFps: number
  autoStepDown: boolean
}

// Render-time state a WebGL implementation reports each frame.
export interface FrameStats {
  fps: number
  frameMs: number
}

// Public surface of the engine — the ONLY thing UI code touches.
export interface AvatarControllerApi {
  readonly status: AvatarStatus
  mount(host: HTMLElement): Promise<AvatarStatus>
  setState(state: CharState): void
  setExpression(expression: AvatarExpression): void
  playGesture(gesture: AvatarGesture): void
  speechLevel(v: number): void
  setBlink(close: number): void
  lookAt(x: number, y: number, z: number): void
  lookAtUser(): void
  setQuality(quality: AvatarQuality): void
  setTheme(theme: 'dark' | 'light'): void
  setEnabled(enabled: boolean): void
  request(request: SemanticRequest): void
  onEvent(cb: (e: AvatarEvent) => void): () => void
  dispose(): void
}

export const DEFAULT_CLIP_MAP: ClipMap = {
  idle: ['idle', 'Idle', 'idle_loop', 'Loop'],
  breathing: ['breathing', 'Breathing', 'breath'],
  standing: ['standing', 'Standing', 'Idle'],
  sitting: ['sitting', 'Sitting', 'Sit'],
  walking: ['walk', 'walking', 'Walk', 'Walking'],
  turning: ['turn', 'turning', 'turn_left', 'Turn'],
  waving: ['wave', 'waving', 'Waving', 'Wave'],
  pointing: ['point', 'pointing', 'point_short', 'Point'],
  nodding: ['nod', 'nodding', 'Nod'],
  headshake: ['headshake', 'head_shake', 'HeadShake', 'shake'],
  greeting: ['greet', 'greeting', 'Greeting', 'hello'],
  thinking: ['think', 'thinking', 'Thinking', 'Think'],
  working: ['working', 'Working', 'type'],
  listening: ['listening', 'Listening', 'listen'],
  speaking: ['speaking', 'Speaking', 'talk', 'Talking', 'speak'],
  success: ['success', 'Success', 'celebrate', 'happy'],
  error: ['error', 'Error', 'upset', 'confused'],
  attention: ['attention', 'Attention', 'alert']
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  enabled: true,
  quality: 'balanced',
  procedural: true,
  eyeBlink: true,
  idleBehavior: true,
  lookAtUser: true,
  lidScale: 0.65,
  speechEnergy: 1,
  expressionSmoothing: 0.35,
  characters: {
    luna: {
      model: '',
      clipMap: DEFAULT_CLIP_MAP,
      idle: ['idle'],
      accent: '#B24BF3'
    },
    shoya: {
      model: '',
      clipMap: DEFAULT_CLIP_MAP,
      idle: ['idle'],
      accent: '#3AD1FF'
    }
  }
}