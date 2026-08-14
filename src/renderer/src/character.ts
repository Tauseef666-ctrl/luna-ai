import {
  AbstractMesh,
  AnimationGroup,
  ArcRotateCamera,
  Bone,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  MorphTarget,
  PointLight,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { CharState } from '../../shared/types'

export interface CharacterHandle {
  setState: (s: CharState) => void
  setMouth: (v: number) => void
  setRingColor: (a: Color3, b: Color3) => void
  loadModel: (path: string) => Promise<boolean>
}

interface Pose {
  rootY?: number
  rootRotX?: number
  lPivot?: { x: number; z: number }
  rPivot?: { x: number; z: number }
  lElbow?: number
  rElbow?: number
  headZ?: number
  headX?: number
}

const POSES: Record<CharState, Pose> = {
  idle: { lPivot: { x: 0, z: 0 }, rPivot: { x: 0, z: 0 }, lElbow: 0, rElbow: 0, headZ: 0, headX: 0 },
  listening: {
    headZ: 0.16,
    headX: 0.04,
    rootY: -0.008,
    rootRotX: 0.05,
    lPivot: { x: 0, z: -0.05 },
    rPivot: { x: 0, z: 0.05 }
  },
  thinking: {
    headZ: -0.1,
    headX: 0.05,
    rootY: 0.004,
    lPivot: { x: 0, z: 0 },
    rPivot: { x: -2.1, z: -0.15 },
    rElbow: 0.6
  },
  speaking: {
    headX: 0.02,
    rootY: 0.002,
    lPivot: { x: 0, z: -0.06 },
    rPivot: { x: 0, z: 0.06 },
    lElbow: -0.1,
    rElbow: -0.1
  },
  working: {
    rootRotX: 0.07,
    headX: -0.04,
    lPivot: { x: -0.35, z: -0.5 },
    rPivot: { x: -0.35, z: 0.5 },
    lElbow: -1.1,
    rElbow: -1.1
  }
}

const STATE_CLIPS: Record<CharState, string[]> = {
  idle: ['idle', 'default', 'breath', 'stand'],
  listening: ['listen', 'attention', 'hear', 'look'],
  thinking: ['think', 'ponder', 'search', 'scratch'],
  speaking: ['speak', 'talk', 'chat', 'gesture', 'waving'],
  working: ['work', 'type', 'code', 'write', 'build']
}

const DEFAULT_TARGET_HEIGHT = 2.2

function mat(scene: Scene, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(`m-${Math.random().toString(36).slice(2)}`, scene)
  m.diffuseColor = color
  m.specularColor = new Color3(0.3, 0.3, 0.4)
  m.specularPower = 32
  if (emissive) m.emissiveColor = emissive
  return m
}

function pickClip(groups: AnimationGroup[], keywords: string[]): AnimationGroup | undefined {
  for (const g of groups) {
    const n = g.name.toLowerCase()
    if (keywords.some((k) => n.includes(k))) return g
  }
  return undefined
}

function findMorphJaw(scene: Scene): MorphTarget | undefined {
  for (const mgr of scene.morphTargetManagers) {
    for (let i = 0; i < mgr.numTargets; i++) {
      const t = mgr.getTarget(i)
      if (/jawopen|^aa$|viseme_?aa|vai/i.test(t.name)) return t
    }
  }
  return undefined
}

function findJawBone(skeletons: { bones: Bone[] }[]): Bone | undefined {
  for (const skel of skeletons) {
    for (const b of skel.bones) {
      if (/jaw|chin|mandible/i.test(b.name)) return b
    }
  }
  return undefined
}

export function createCharacterScene(canvas: HTMLCanvasElement, mode: 'full' | 'half'): CharacterHandle {
  const engine = new Engine(canvas, true, { antialias: true, alpha: true, preserveDrawingBuffer: true }, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0, 0, 0, 0)

  const camera = new ArcRotateCamera(
    'cam',
    mode === 'half' ? 0 : 0.55,
    mode === 'half' ? 1.32 : 1.15,
    mode === 'half' ? 2.05 : 3.35,
    new Vector3(0, mode === 'half' ? 1.3 : 1.05, 0),
    scene
  )
  camera.lowerRadiusLimit = 1.6
  camera.upperRadiusLimit = 6
  camera.minZ = 0.1
  if (mode === 'full') camera.attachControl(canvas, true)

  const key = new HemisphericLight('key', new Vector3(0.4, 1, 0.6), scene)
  key.intensity = 0.85
  const fill = new PointLight('fill', new Vector3(0, 1.5, -2), scene)
  fill.intensity = 0.35
  fill.diffuse = new Color3(0.7, 0.5, 1)
  const rim = new PointLight('rim', new Vector3(-1.2, 2, 1.6), scene)
  rim.intensity = 0.5
  rim.diffuse = new Color3(0.3, 0.8, 1)

  // ---------------- placeholder rig (spec 32.1 fallback) ----------------
  const root = new Mesh('root', scene)
  root.position.y = 0

  const skin = mat(scene, new Color3(0.97, 0.8, 0.68))
  const cloth = mat(scene, new Color3(0.42, 0.24, 0.95))
  const clothDark = mat(scene, new Color3(0.28, 0.17, 0.66))
  const hair = mat(scene, new Color3(0.15, 0.11, 0.3))
  hair.emissiveColor = new Color3(0.03, 0.02, 0.08)
  const dark = mat(scene, new Color3(0.13, 0.13, 0.2))
  const ringMat = mat(scene, new Color3(0.5, 0.3, 1), new Color3(0.7, 0.45, 1))
  const accentMat = mat(scene, new Color3(0.25, 0.85, 1), new Color3(0.2, 0.75, 1))

  // torso (slightly tapered), hips, neck, head
  const torso = MeshBuilder.CreateCapsule(
    'torso',
    { height: 0.55, radius: 0.24, capSubdivisions: 4, tessellation: 24 },
    scene
  )
  torso.parent = root
  torso.position.y = 1.05
  torso.material = cloth

  const chest = MeshBuilder.CreateBox('chest', { width: 0.26, height: 0.18, depth: 0.1 }, scene)
  chest.parent = root
  chest.position.y = 1.12
  chest.position.z = 0.2
  chest.rotation.x = 0.12
  chest.material = accentMat

  const hips = MeshBuilder.CreateCapsule('hips', { height: 0.3, radius: 0.23, capSubdivisions: 2 }, scene)
  hips.parent = root
  hips.position.y = 0.84
  hips.material = clothDark

  const neck = MeshBuilder.CreateCapsule('neck', { height: 0.12, radius: 0.06 }, scene)
  neck.parent = root
  neck.position.y = 1.38
  neck.material = skin

  const head = MeshBuilder.CreateSphere('head', { diameter: 0.34, segments: 32 }, scene)
  head.parent = root
  head.position.y = 1.54
  head.scaling.y = 1.08
  head.material = skin

  // hair: cap + fringe + side locks
  const hairCap = MeshBuilder.CreateSphere('hair', { diameter: 0.37, segments: 24 }, scene)
  hairCap.parent = root
  hairCap.position.y = 1.59
  hairCap.scaling.y = 1.12
  hairCap.scaling.z = 1.08
  hairCap.material = hair

  const fringe = MeshBuilder.CreateSphere('fringe', { diameter: 0.35, segments: 16 }, scene)
  fringe.parent = root
  fringe.position.set(-0.01, 1.58, 0.14)
  fringe.scaling = new Vector3(0.96, 0.8, 0.5)
  fringe.material = hair

  for (const s of [-1, 1]) {
    const lock = MeshBuilder.CreateSphere(`lock${s}`, { diameter: 0.12, segments: 12 }, scene)
    lock.parent = root
    lock.position.set(0.14 * s, 1.5, 0.02)
    lock.scaling = new Vector3(1, 1.7, 0.7)
    lock.material = hair
  }

  // face: eyes (glowing), brows, nose, jaw
  const eyeMat = mat(scene, new Color3(0.7, 0.5, 1), new Color3(0.75, 0.55, 1))
  const pupilMat = mat(scene, new Color3(0.05, 0.05, 0.1))
  for (const s of [-1, 1]) {
    const eye = MeshBuilder.CreateSphere(`eye${s}`, { diameter: 0.045, segments: 12 }, scene)
    eye.parent = head
    eye.position.x = 0.065 * s
    eye.position.y = 0.045
    eye.position.z = 0.155
    eye.material = eyeMat
    const pupil = MeshBuilder.CreateSphere(`pupil${s}`, { diameter: 0.018, segments: 8 }, scene)
    pupil.parent = head
    pupil.position.x = 0.065 * s
    pupil.position.y = 0.045
    pupil.position.z = 0.178
    pupil.material = pupilMat
  }
  for (const s of [-1, 1]) {
    const brow = MeshBuilder.CreateBox(`brow${s}`, { width: 0.055, height: 0.012, depth: 0.01 }, scene)
    brow.parent = head
    brow.position.x = 0.065 * s
    brow.position.y = 0.09
    brow.position.z = 0.16
    brow.material = hair
  }
  const nose = MeshBuilder.CreateBox('nose', { width: 0.03, height: 0.045, depth: 0.03 }, scene)
  nose.parent = head
  nose.position.y = 0.0
  nose.position.z = 0.17
  nose.material = skin

  const jaw = MeshBuilder.CreateBox('jaw', { size: 1 }, scene)
  jaw.parent = head
  jaw.position.y = -0.1
  jaw.position.z = 0.15
  jaw.scaling = new Vector3(0.15, 0.07, 0.05)
  jaw.material = skin

  // limbs
  function limb(
    name: string,
    pivotPos: Vector3,
    len: number,
    radius: number,
    matL: StandardMaterial
  ): {
    pivot: Mesh
    elbow: Mesh
  } {
    const pivot = new Mesh(`${name}-pivot`, scene)
    pivot.parent = root
    pivot.position.copyFrom(pivotPos)
    const upper = MeshBuilder.CreateCapsule(
      `${name}-upper`,
      { height: len, radius, capSubdivisions: 2, tessellation: 16 },
      scene
    )
    upper.parent = pivot
    upper.position.y = -len / 2
    upper.material = matL
    const elbow = new Mesh(`${name}-elbow`, scene)
    elbow.parent = pivot
    elbow.position.y = -len
    const lower = MeshBuilder.CreateCapsule(
      `${name}-lower`,
      { height: len, radius: radius * 0.8, capSubdivisions: 2, tessellation: 16 },
      scene
    )
    lower.parent = elbow
    lower.position.y = -len / 2
    lower.material = matL
    return { pivot, elbow }
  }

  const lArm = limb('lArm', new Vector3(-0.3, 1.32, 0), 0.26, 0.06, cloth)
  const rArm = limb('rArm', new Vector3(0.3, 1.32, 0), 0.26, 0.06, cloth)
  const lLeg = limb('lLeg', new Vector3(-0.14, 0.82, 0), 0.4, 0.11, clothDark)
  const rLeg = limb('rLeg', new Vector3(0.14, 0.82, 0), 0.4, 0.11, clothDark)

  for (const side of ['l', 'r']) {
    const hand = MeshBuilder.CreateSphere(`${side}Hand`, { diameter: 0.1, segments: 16 }, scene)
    const arm = side === 'l' ? lArm : rArm
    hand.parent = arm.elbow
    hand.position.y = -0.27
    hand.material = dark
  }
  for (const side of ['l', 'r']) {
    const foot = MeshBuilder.CreateBox(`${side}Foot`, { width: 0.14, height: 0.08, depth: 0.24 }, scene)
    const leg = side === 'l' ? lLeg : rLeg
    foot.parent = leg.elbow
    foot.position.y = -0.42
    foot.position.z = 0.03
    foot.material = dark
  }

  // shoulder accents
  for (const s of [-1, 1]) {
    const pad = MeshBuilder.CreateSphere(`pad${s}`, { diameter: 0.12, segments: 12 }, scene)
    pad.parent = root
    pad.position.set(0.31 * s, 1.32, 0)
    pad.material = accentMat
  }

  // shadow blob
  const shadow = MeshBuilder.CreateDisc('shadow', { radius: 0.62, tessellation: 32 }, scene)
  shadow.rotation.x = Math.PI / 2
  shadow.position.y = 0.004
  const shadowMat = mat(scene, new Color3(0, 0, 0))
  shadowMat.alpha = 0.45
  shadow.material = shadowMat

  // dashboard platform ring (kept when a real model loads)
  let ring: Mesh | null = null
  let glow: Mesh | null = null
  if (mode === 'full') {
    ring = MeshBuilder.CreateTorus('ring', { diameter: 1.2, thickness: 0.03, tessellation: 48 }, scene)
    ring.position.y = 0.02
    ring.rotation.x = Math.PI / 2
    ring.material = ringMat

    glow = MeshBuilder.CreateDisc('glow', { radius: 1.05, tessellation: 40 }, scene)
    glow.position.y = 0.005
    glow.rotation.x = Math.PI / 2
    const glowMat = mat(scene, new Color3(0.45, 0.2, 0.9))
    glowMat.emissiveColor = new Color3(0.3, 0.14, 0.7)
    glowMat.alpha = 0.5
    glow.material = glowMat
  }

  // half-body windowsill
  if (mode === 'half') {
    const sill = MeshBuilder.CreateBox('sill', { width: 2.4, height: 0.3, depth: 0.8 }, scene)
    sill.position.y = 0.62
    sill.position.z = -0.2
    const sillMat = mat(scene, new Color3(0.1, 0.09, 0.2))
    sillMat.alpha = 0.9
    sill.material = sillMat
  }

  // ---------------- loaded model state ----------------
  let modelActive = false
  let modelRoot: TransformNode | null = null
  let modelGroups: AnimationGroup[] = []
  let jawMorph: MorphTarget | undefined
  let jawBone: Bone | undefined
  let lastClip: AnimationGroup | null = null

  // ---------------- procedural animation ----------------
  let state: CharState = 'idle'
  let mouth = 0
  let t = 0

  const current: Required<Record<'lPivot' | 'rPivot', { x: number; z: number }>> & {
    rootY: number
    rootRotX: number
    lElbow: number
    rElbow: number
    headZ: number
    headX: number
  } = {
    rootY: 0,
    rootRotX: 0,
    lPivot: { x: 0, z: 0 },
    rPivot: { x: 0, z: 0 },
    lElbow: 0,
    rElbow: 0,
    headZ: 0,
    headX: 0
  }

  scene.registerBeforeRender(() => {
    t += engine.getDeltaTime() / 1000
    const p = POSES[state]
    const k = 0.08

    if (!modelActive) {
      current.rootY += ((p.rootY ?? 0) - current.rootY) * k
      current.rootRotX += ((p.rootRotX ?? 0) - current.rootRotX) * k
      current.lPivot.x += ((p.lPivot?.x ?? 0) - current.lPivot.x) * k
      current.lPivot.z += ((p.lPivot?.z ?? 0) - current.lPivot.z) * k
      current.rPivot.x += ((p.rPivot?.x ?? 0) - current.rPivot.x) * k
      current.rPivot.z += ((p.rPivot?.z ?? 0) - current.rPivot.z) * k
      current.lElbow += ((p.lElbow ?? 0) - current.lElbow) * k
      current.rElbow += ((p.rElbow ?? 0) - current.rElbow) * k
      current.headZ += ((p.headZ ?? 0) - current.headZ) * k
      current.headX += ((p.headX ?? 0) - current.headX) * k

      const breathe = Math.sin(t * 1.8) * 0.012
      torso.scaling.y = 1 + breathe
      const bob = Math.sin(t * 1.4) * 0.008
      const sway = state === 'idle' || state === 'speaking' ? Math.sin(t * 0.9) * 0.06 : 0

      root.position.y = current.rootY + bob
      root.rotation.x = current.rootRotX
      root.rotation.z = Math.sin(t * 0.6) * 0.01

      lArm.pivot.rotation.x = current.lPivot.x
      lArm.pivot.rotation.z = current.lPivot.z + sway
      rArm.pivot.rotation.x = current.rPivot.x
      rArm.pivot.rotation.z = current.rPivot.z - sway
      lArm.elbow.rotation.z = current.lElbow
      rArm.elbow.rotation.z = current.rElbow

      lLeg.pivot.rotation.x = Math.sin(t * 1.4) * 0.02
      rLeg.pivot.rotation.x = -Math.sin(t * 1.4) * 0.02

      head.rotation.z = current.headZ
      head.rotation.x = current.headX + (state === 'speaking' ? Math.sin(t * 4) * 0.015 : 0)
      jaw.scaling.y = 1 + mouth * 0.9
    } else if (modelRoot) {
      // subtle life overlay on the real model
      const bob = Math.sin(t * 1.4) * 0.006
      modelRoot.position.y = bob
      modelRoot.rotation.z = Math.sin(t * 0.6) * 0.008
      if (jawMorph) jawMorph.influence = mouth
      else if (jawBone) jawBone.setYawPitchRoll(0, -mouth * 0.45, 0)
    }

    if (ring) {
      ring.rotation.y = t * 0.3
      ring.position.y = 0.02 + Math.sin(t * 1.4) * 0.012
    }
    if (glow) {
      glow.scaling.setAll(1 + Math.sin(t * 1.4) * 0.03)
      ;(glow.material as StandardMaterial).alpha = 0.42 + Math.sin(t * 1.4) * 0.08
    }
  })

  engine.runRenderLoop(() => scene.render())

  function playState(state2: CharState): void {
    if (!modelActive || modelGroups.length === 0) return
    if (lastClip) lastClip.stop()
    const clip = pickClip(modelGroups, STATE_CLIPS[state2]) ?? pickClip(modelGroups, STATE_CLIPS.idle)
    if (!clip) {
      lastClip = null
      return
    }
    clip.stop()
    clip.loopAnimation = true
    clip.start(true, 1, 0, 0)
    lastClip = clip
  }

  const handle: CharacterHandle = {
    setState: (s) => {
      state = s
      playState(s)
    },
    setMouth: (v) => {
      mouth = Math.max(0, Math.min(1, v))
    },
    setRingColor: (a, b) => {
      ringMat.diffuseColor = a
      ringMat.emissiveColor = b
    },
    loadModel: async (path: string): Promise<boolean> => {
      if (!path) return false
      try {
        const data = await window.luna.assets.binary(path)
        if (!data || data.byteLength === 0) return false
        const name = path.split(/[\\/]/).pop() ?? 'model'
        const ext = (name.split('.').pop() ?? '').toLowerCase()
        const type =
          ext === 'glb'
            ? 'model/gltf-binary'
            : ext === 'gltf'
              ? 'model/gltf+json'
              : ext === 'fbx'
                ? 'application/octet-stream'
                : 'application/octet-stream'
        const file = new File([new Uint8Array(data)], name, { type })

        // drop the placeholder rig, keep platform
        root.setEnabled(false)

        let result: {
          meshes: TransformNode[]
          skeletons: { bones: Bone[] }[]
          animationGroups: AnimationGroup[]
        }
        try {
          const imported = await SceneLoader.ImportMeshAsync('', '', file, scene)
          result = imported as typeof imported & {
            meshes: TransformNode[]
            skeletons: { bones: Bone[] }[]
            animationGroups: AnimationGroup[]
          }
        } catch {
          root.setEnabled(true)
          return false
        }

        if (result.meshes.length === 0) {
          root.setEnabled(true)
          return false
        }

        modelRoot = result.meshes[0]
        modelRoot.name = 'character-model'
        modelGroups = result.animationGroups ?? []

        // fit to a consistent height and center on the platform
        const min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE)
        const max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE)
        for (const m of result.meshes) {
          if (!(m instanceof AbstractMesh)) continue
          const b = m.getBoundingInfo().boundingBox
          min.minimizeInPlace(b.minimum)
          max.maximizeInPlace(b.maximum)
        }
        const height = Math.max(0.001, max.y - min.y)
        const scale = DEFAULT_TARGET_HEIGHT / height
        modelRoot.scaling.scaleInPlace(scale)
        modelRoot.position.y = 0
        modelRoot.rotation.y = mode === 'full' ? 0.35 : 0

        jawMorph = findMorphJaw(scene)
        jawBone = findJawBone(result.skeletons)

        modelActive = true
        playState(state)
        return true
      } catch {
        root.setEnabled(true)
        return false
      }
    }
  }

  const onResize = (): void => engine.resize()
  window.addEventListener('resize', onResize)
  scene.onDispose = () => {
    window.removeEventListener('resize', onResize)
  }

  return handle
}
