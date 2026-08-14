import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core'
import type { CharState } from '../../shared/types'

export interface CharacterHandle {
  engine: Engine
  scene: Scene
  setState: (s: CharState) => void
  setMouth: (v: number) => void
  setRingColor: (a: Color3, b: Color3) => void
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

function mat(scene: Scene, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(`m-${Math.random().toString(36).slice(2)}`, scene)
  m.diffuseColor = color
  if (emissive) m.emissiveColor = emissive
  return m
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

  // ---- placeholder rig (spec 32.1 fallback) ----
  const root = new Mesh('root', scene)
  root.position.y = 0

  const skin = mat(scene, new Color3(1, 0.83, 0.72))
  const cloth = mat(scene, new Color3(0.55, 0.3, 0.95))
  const clothDark = mat(scene, new Color3(0.35, 0.2, 0.7))
  const hair = mat(scene, new Color3(0.16, 0.12, 0.28))
  const dark = mat(scene, new Color3(0.13, 0.13, 0.2))
  const ringMat = mat(scene, new Color3(0.5, 0.3, 1), new Color3(0.7, 0.45, 1))

  const torso = MeshBuilder.CreateCapsule('torso', { height: 0.55, radius: 0.24, capSubdivisions: 4, tessellation: 24 }, scene)
  torso.parent = root
  torso.position.y = 1.05
  torso.material = cloth

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
  head.material = skin

  const hairCap = MeshBuilder.CreateSphere('hair', { diameter: 0.37, segments: 24 }, scene)
  hairCap.parent = root
  hairCap.position.y = 1.58
  hairCap.position.z = -0.02
  hairCap.scaling.y = 1.08
  hairCap.scaling.z = 1.06
  hairCap.material = hair

  const jaw = MeshBuilder.CreateBox('jaw', { size: 1 }, scene)
  jaw.parent = head
  jaw.position.y = -0.1
  jaw.position.z = 0.14
  jaw.scaling = new Vector3(0.15, 0.08, 0.04)
  jaw.material = skin

  const eyeMat = mat(scene, new Color3(0.1, 0.1, 0.18))
  for (const s of [-1, 1]) {
    const eye = MeshBuilder.CreateSphere(`eye${s}`, { diameter: 0.035, segments: 12 }, scene)
    eye.parent = head
    eye.position.x = 0.06 * s
    eye.position.y = 0.03
    eye.position.z = 0.16
    eye.material = eyeMat
  }

  // limb factory: pivot at shoulder/hip, upper+lower segments
  function limb(name: string, pivotPos: Vector3, len: number, radius: number, matL: StandardMaterial): {
    pivot: Mesh
    elbow: Mesh
  } {
    const pivot = new Mesh(`${name}-pivot`, scene)
    pivot.parent = root
    pivot.position.copyFrom(pivotPos)
    const upper = MeshBuilder.CreateCapsule(`${name}-upper`, { height: len, radius, capSubdivisions: 2, tessellation: 16 }, scene)
    upper.parent = pivot
    upper.position.y = -len / 2
    upper.material = matL
    const elbow = new Mesh(`${name}-elbow`, scene)
    elbow.parent = pivot
    elbow.position.y = -len
    const lower = MeshBuilder.CreateCapsule(`${name}-lower`, { height: len, radius: radius * 0.8, capSubdivisions: 2, tessellation: 16 }, scene)
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
    const hand = MeshBuilder.CreateSphere(`${side}Hand`, { diameter: 0.09, segments: 16 }, scene)
    const arm = side === 'l' ? lArm : rArm
    hand.parent = arm.elbow
    hand.position.y = -0.26
    hand.material = skin
  }
  for (const side of ['l', 'r']) {
    const foot = MeshBuilder.CreateBox(`${side}Foot`, { width: 0.14, height: 0.08, depth: 0.22 }, scene)
    const leg = side === 'l' ? lLeg : rLeg
    foot.parent = leg.elbow
    foot.position.y = -0.42
    foot.position.z = 0.03
    foot.material = dark
  }

  // dashboard platform ring
  let ring: Mesh | null = null
  if (mode === 'full') {
    ring = MeshBuilder.CreateTorus('ring', { diameter: 1.15, thickness: 0.035, tessellation: 48 }, scene)
    ring.parent = root
    ring.position.y = 0.02
    ring.rotation.x = Math.PI / 2
    ring.material = ringMat
    const disc = MeshBuilder.CreateDisc('disc', { radius: 1.1, tessellation: 48 }, scene)
    disc.parent = root
    disc.position.y = 0.005
    disc.rotation.x = Math.PI / 2
    const discMat = mat(scene, new Color3(0, 0, 0))
    discMat.alpha = 0.35
    discMat.diffuseColor = new Color3(0.35, 0.18, 0.7)
    disc.material = discMat
  }

  // half-body windowsill (resting-arms framing, spec 2.1)
  let sill: Mesh | null = null
  if (mode === 'half') {
    sill = MeshBuilder.CreateBox('sill', { width: 2.4, height: 0.3, depth: 0.8 }, scene)
    sill.position.y = 0.62
    sill.position.z = -0.2
    const sillMat = mat(scene, new Color3(0.1, 0.09, 0.2))
    sillMat.alpha = 0.9
    sill.material = sillMat
  }

  // ---- procedural animation ----
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

    // breathing + idle sway overlays
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

    // legs: gentle weight shift
    lLeg.pivot.rotation.x = Math.sin(t * 1.4) * 0.02
    rLeg.pivot.rotation.x = -Math.sin(t * 1.4) * 0.02

    head.rotation.z = current.headZ
    head.rotation.x = current.headX + (state === 'speaking' ? Math.sin(t * 4) * 0.015 : 0)
    jaw.scaling.y = 1 + mouth * 0.9

    if (ring) {
      ring.rotation.y = t * 0.3
      ring.position.y = 0.02 + Math.sin(t * 1.4) * 0.01
    }
  })

  engine.runRenderLoop(() => scene.render())

  const handle: CharacterHandle = {
    engine,
    scene,
    setState: (s) => {
      state = s
    },
    setMouth: (v) => {
      mouth = Math.max(0, Math.min(1, v))
    },
    setRingColor: (a, b) => {
      ringMat.diffuseColor = a
      ringMat.emissiveColor = b
    }
  }

  const onResize = (): void => engine.resize()
  window.addEventListener('resize', onResize)
  handle.scene.onDispose = () => {
    window.removeEventListener('resize', onResize)
  }

  return handle
}
