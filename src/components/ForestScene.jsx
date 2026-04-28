import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, PerspectiveCamera, Sky, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import Tree from './Tree'
import AmbientLife from './AmbientLife'
import {
  TERRAIN_PADDING,
  TERRAIN_SEGMENTS,
  WORLD_RADIUS,
  getTerrainHeight,
  sampleTerrainMeshHeight,
  mapToWorld,
  GLOBE_RADIUS,
  WATER_LEVEL,
  findDryLand,
  getHabitStreak,
  getMilestone,
} from '../lib/forest'

const TERRAIN_Y_OFFSET = -0.18
const TREE_GROUND_EMBED = 0.22
const FENCE_RADIUS = WORLD_RADIUS + 4.5
const FENCE_POST_COUNT = 56

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const ROCKS = Array.from({ length: 50 }, (_, index) => {
  const x = (pseudoRandom(index * 11 + 5) * 2 - 1) * (WORLD_RADIUS + 2)
  const z = (pseudoRandom(index * 13 + 7) * 2 - 1) * (WORLD_RADIUS + 2)

  return {
    id: `rock-${index}`,
    x,
    z,
    scale: 0.3 + pseudoRandom(index * 17) * 0.8,
    type: Math.floor(pseudoRandom(index * 21) * 3),
    rotation: [
      0, // Only rotate on Y axis so roots point strictly downwards
      pseudoRandom(index * 23) * Math.PI * 2,
      0,
    ],
  }
})

const BUSHES = Array.from({ length: 90 }, (_, index) => {
  const angle  = pseudoRandom(index * 7  + 3) * Math.PI * 2
  const radius = Math.sqrt(pseudoRandom(index * 11 + 9)) * (WORLD_RADIUS - 3)
  return {
    id:       `bush-${index}`,
    x:        Math.cos(angle) * radius,
    z:        Math.sin(angle) * radius,
    scale:    0.30 + pseudoRandom(index * 19) * 0.65,
    type:     Math.floor(pseudoRandom(index * 29) * 3),
    rotation: pseudoRandom(index * 37) * Math.PI * 2,
  }
})


const TIME_PRESETS = {
  dawn: {
    background: '#8fa9b3',
    fog: '#b6cbd0',
    ambient: 0.9,
    sunIntensity: 1.25,
    sunColor: '#ffdca8',
    sunPosition: [18, 22, 6],
    skyTint: '#c8e0da',
    ground: '#667f54',
    patch: '#96ab80',
    rock: '#8f9382',
    sparkle: '#fdf7d0',
    cameraPosition: [36, 21, 36],
  },
  day: {
    background: '#6ea3c2',
    fog: '#a8cfe0',
    ambient: 1.05,
    sunIntensity: 1.45,
    sunColor: '#fff1cc',
    sunPosition: [22, 28, 10],
    skyTint: '#bfdcf3',
    ground: '#5f7e4b',
    patch: '#95b27b',
    rock: '#8c9288',
    sparkle: '#e8f4d4',
    cameraPosition: [35, 20, 35],
  },
  dusk: {
    background: '#485a7a',
    fog: '#7285a1',
    ambient: 0.68,
    sunIntensity: 0.98,
    sunColor: '#ffb37d',
    sunPosition: [-16, 16, 8],
    skyTint: '#d5c0cf',
    ground: '#536747',
    patch: '#81946d',
    rock: '#7b7d82',
    sparkle: '#ffe5a6',
    cameraPosition: [37, 22, 37],
  },
}

// ── Continuous palette interpolation ────────────────────────────────────────────
function hexToRgb(h) {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)]
}
function lerpHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b)
  return '#' + ra.map((v,i) => Math.round(v+(rb[i]-v)*t).toString(16).padStart(2,'0')).join('')
}
const lerpN = (a, b, t) => a + (b - a) * t
const lerpV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

const PALETTES = [TIME_PRESETS.dawn, TIME_PRESETS.day, TIME_PRESETS.dusk]

function interpolatePalette(t) {
  // t: 0 = dawn, 0.5 = day, 1 = dusk
  const [from, to, lt] = t <= 0.5
    ? [PALETTES[0], PALETTES[1], t * 2]
    : [PALETTES[1], PALETTES[2], (t - 0.5) * 2]
  return {
    background:     lerpHex(from.background,     to.background,     lt),
    fog:            lerpHex(from.fog,             to.fog,            lt),
    ambient:        lerpN(from.ambient,           to.ambient,        lt),
    sunIntensity:   lerpN(from.sunIntensity,      to.sunIntensity,   lt),
    sunColor:       lerpHex(from.sunColor,        to.sunColor,       lt),
    sunPosition:    lerpV(from.sunPosition,       to.sunPosition,    lt),
    skyTint:        lerpHex(from.skyTint,         to.skyTint,        lt),
    ground:         lerpHex(from.ground,          to.ground,         lt),
    patch:          lerpHex(from.patch,           to.patch,          lt),
    rock:           lerpHex(from.rock,            to.rock,           lt),
    sparkle:        lerpHex(from.sparkle,         to.sparkle,        lt),
    cameraPosition: lerpV(from.cameraPosition,    to.cameraPosition, lt),
  }
}

// ── Glowing sun disc in the sky ───────────────────────────────────────────────
function SunDisc({ sunPosition, sunColor }) {
  const pos = useMemo(() => {
    const v = new THREE.Vector3(sunPosition[0], sunPosition[1], sunPosition[2]).normalize()
    return [v.x * 420, v.y * 420, v.z * 420]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sunPosition[0], sunPosition[1], sunPosition[2]])

  if (sunPosition[1] < 0) return null   // below horizon

  return (
    <group position={pos}>
      {/* Wide outer halo */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[32, 16, 8]} />
        <meshBasicMaterial color={sunColor} fog={false} transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* Mid corona */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[20, 16, 8]} />
        <meshBasicMaterial color={sunColor} fog={false} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {/* Sun core */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[12, 16, 8]} />
        <meshBasicMaterial color={sunColor} fog={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Ground({ palette, terrainSettings, globalSeed, worldShape }) {
  const terrainGeometry = useMemo(() => {
    const size = (WORLD_RADIUS + TERRAIN_PADDING) * 2
    const segments = TERRAIN_SEGMENTS
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    const positions = geometry.attributes.position
    const colors = new Float32Array(positions.count * 4)

    // 5-zone height-based palette
    const cBeach    = new THREE.Color('#cdb87a').convertSRGBToLinear()
    const cShore    = new THREE.Color('#8e9968').convertSRGBToLinear()
    const cLowland  = new THREE.Color(palette.ground).convertSRGBToLinear()
    const cMeadow   = new THREE.Color(palette.patch).convertSRGBToLinear()
    const cHighland = new THREE.Color(palette.rock).convertSRGBToLinear()
    const color = new THREE.Color()

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = -positions.getY(index)
      const y = getTerrainHeight(x, z, terrainSettings, globalSeed) || 0

      const mapped = mapToWorld(x, y, z, worldShape)
      positions.setXYZ(index, mapped.position[0], mapped.position[1], mapped.position[2])

      const maxDist = worldShape === 'plane'
        ? Math.max(Math.abs(x), Math.abs(z))
        : Math.hypot(x, z)

      let alpha = 1.0
      if (maxDist > WORLD_RADIUS + 2) {
        alpha = Math.max(0, 1.0 - (maxDist - (WORLD_RADIUS + 2)) / 8)
      }

      // Approximate slope for rocky-steep blending
      const eps = 1.2
      const dy_dx = (getTerrainHeight(x + eps, z, terrainSettings, globalSeed) - y) / eps
      const dy_dz = (getTerrainHeight(x, z + eps, terrainSettings, globalSeed) - y) / eps
      const slope = Math.min(1, Math.sqrt(dy_dx * dy_dx + dy_dz * dy_dz) * 1.8)

      // Per-vertex noise for organic variation
      const nv = (Math.sin(x * 0.21 + 1.4) * Math.cos(z * 0.18 - 0.7)) * 0.18

      // Height zone thresholds — narrow beach, rest is green
      const wl = WATER_LEVEL
      if (y < wl + 0.05) {
        // Thin sandy strip right at water
        color.copy(cBeach)
      } else if (y < wl + 0.14) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.05)) / 0.09))
        color.copy(cBeach).lerp(cShore, t)
      } else if (y < wl + 0.28 + nv) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.14)) / 0.14))
        color.copy(cShore).lerp(cLowland, t)
      } else if (y < 0.75 + nv) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.28)) / 0.75))
        color.copy(cLowland).lerp(cMeadow, t)
      } else if (y < 1.40 + nv) {
        const t = Math.max(0, Math.min(1, (y - 0.75) / 0.65))
        color.copy(cMeadow).lerp(cHighland, t * 0.85)
      } else {
        color.copy(cHighland)
      }

      // Steep slopes → rocky regardless of height
      if (slope > 0.25) {
        color.lerp(cHighland, Math.min(1, (slope - 0.25) / 0.55))
      }

      colors[index * 4]     = color.r
      colors[index * 4 + 1] = color.g
      colors[index * 4 + 2] = color.b
      colors[index * 4 + 3] = alpha
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    geometry.attributes.color.needsUpdate = true
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [terrainSettings, palette, globalSeed, worldShape])

  useEffect(() => {
    return () => {
      terrainGeometry.dispose()
    }
  }, [terrainGeometry])

  return (
    <group>
      <mesh
        receiveShadow
        position={[0, TERRAIN_Y_OFFSET, 0]}
        geometry={terrainGeometry}
      >
        <meshStandardMaterial vertexColors={true} roughness={1} transparent={true} alphaTest={0.05} />
      </mesh>
    </group>
  )
}

function Water({ worldShape }) {
  const waterGeometry = useMemo(() => {
    const size     = (WORLD_RADIUS + TERRAIN_PADDING) * 2
    const segments = worldShape === 'plane' ? 80 : 64
    const geometry = worldShape === 'plane'
      ? new THREE.PlaneGeometry(size, size, segments, segments)
      : new THREE.SphereGeometry(GLOBE_RADIUS + WATER_LEVEL, segments, segments, 0, Math.PI * 2, 0, Math.PI / 2)

    const positions = geometry.attributes.position
    const colors    = new Float32Array(positions.count * 4)

    for (let i = 0; i < positions.count; i++) {
      let x, z
      if (worldShape === 'plane') {
        x = positions.getX(i); z = positions.getY(i)
      } else {
        x = positions.getX(i); z = positions.getZ(i)
      }
      const maxDist = worldShape === 'plane'
        ? Math.max(Math.abs(x), Math.abs(z)) : Math.hypot(x, z)

      let alpha = 0.92
      if (maxDist > WORLD_RADIUS + 2)
        alpha = Math.max(0, 0.92 * (1.0 - (maxDist - (WORLD_RADIUS + 2)) / 8))

      const depthFactor = Math.max(0, Math.min(1, 1 - maxDist / WORLD_RADIUS))
      colors[i * 4]     = 0.06 + depthFactor * 0.04
      colors[i * 4 + 1] = 0.20 + depthFactor * 0.06
      colors[i * 4 + 2] = 0.42 + depthFactor * 0.08
      colors[i * 4 + 3] = alpha
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    return geometry
  }, [worldShape])

  return (
    <mesh
      position={worldShape === 'plane' ? [0, WATER_LEVEL + TERRAIN_Y_OFFSET, 0] : [0, -GLOBE_RADIUS + TERRAIN_Y_OFFSET, 0]}
      rotation={worldShape === 'plane' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
      geometry={waterGeometry}
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors={true}
        transparent={true}
        roughness={0.04}
        metalness={0.30}
        envMapIntensity={1.4}
        alphaTest={0.01}
      />
    </mesh>
  )
}

// Expanding ring ripples on the water surface
function WaterRipples({ worldShape }) {
  const groupRef   = useRef(null)
  const active     = useRef([])
  const nextSpawn  = useRef(1.0)

  useFrame(({ clock }) => {
    if (worldShape !== 'plane' || !groupRef.current) return
    const t = clock.elapsedTime

    // Spawn a new ripple
    if (t >= nextSpawn.current) {
      const angle = Math.random() * Math.PI * 2
      const dist  = Math.random() * WORLD_RADIUS * 0.70
      const cx    = Math.cos(angle) * dist
      const cz    = Math.sin(angle) * dist

      const duration  = 3.0 + Math.random() * 2.5
      const maxRadius = 1.5 + Math.random() * 2.0

      // Use a thin ring: inner=0.82, outer=1.0 of scale
      const geo = new THREE.RingGeometry(0.82, 1.0, 56)
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55, 0.78, 0.92),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      // Rings lie flat on the water plane
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(cx, WATER_LEVEL + TERRAIN_Y_OFFSET + 0.04, cz)
      groupRef.current.add(mesh)

      active.current.push({ mesh, mat, startTime: t, duration, maxRadius })
      nextSpawn.current = t + 1.8 + Math.random() * 2.5
    }

    // Update each ring
    active.current = active.current.filter(rp => {
      const elapsed  = t - rp.startTime
      if (elapsed >= rp.duration) {
        groupRef.current?.remove(rp.mesh)
        rp.mesh.geometry.dispose()
        rp.mat.dispose()
        return false
      }
      const progress    = elapsed / rp.duration          // 0 → 1
      const scale       = 0.05 + progress * rp.maxRadius  // starts tiny
      rp.mesh.scale.set(scale, scale, 1)
      rp.mat.opacity    = (1 - progress) * 0.55
      return true
    })
  })

  if (worldShape !== 'plane') return null
  return <group ref={groupRef} />
}

function RockModel({ type, palette }) {
  const material = <meshStandardMaterial color={palette.rock} flatShading roughness={0.95} />

  if (type === 0) {
    // Wide, flat rock outcrop
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, -0.6, 0]} scale={[1.6, 1.2, 1.4]}>
          <dodecahedronGeometry args={[1, 0]} />
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[0.8, -0.8, -0.5]} scale={[1.0, 1.0, 1.1]}>
          <icosahedronGeometry args={[1, 0]} />
          {material}
        </mesh>
      </group>
    )
  }

  if (type === 1) {
    // Cluster of jagged rocks
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, -0.5, 0]} scale={[0.9, 1.5, 0.9]} rotation={[0.2, 0.4, 0.1]}>
          <icosahedronGeometry args={[1, 0]} />
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[0.7, -0.8, 0.4]} scale={[0.7, 1.2, 0.8]} rotation={[-0.3, 0.1, -0.2]}>
          <octahedronGeometry args={[1, 0]} />
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[-0.6, -0.7, -0.3]} scale={[0.8, 1.0, 0.7]} rotation={[0.1, -0.4, 0.2]}>
          <dodecahedronGeometry args={[1, 0]} />
          {material}
        </mesh>
      </group>
    )
  }

  // Blocky, massive buried boulder
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -1.0, 0]} scale={[1.4, 1.8, 1.3]} rotation={[0.4, 0, 0.3]}>
        <octahedronGeometry args={[1, 0]} />
        {material}
      </mesh>
      <mesh castShadow receiveShadow position={[-0.5, -0.8, 0.6]} scale={[1.1, 1.4, 1.1]} rotation={[0, 0.6, 0]}>
        <dodecahedronGeometry args={[1, 0]} />
        {material}
      </mesh>
    </group>
  )
}

function BushModel({ type, palette }) {
  const outer = <meshStandardMaterial color={palette.patch} roughness={0.95} flatShading />
  const inner = <meshStandardMaterial color={palette.ground} roughness={0.95} flatShading />

  if (type === 0) {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.48, 0]} scale={[1, 0.88, 1]}>
          <sphereGeometry args={[0.68, 6, 5]} />{outer}
        </mesh>
        <mesh castShadow receiveShadow position={[0.38, 0.30, 0.22]} scale={[0.6, 0.6, 0.6]}>
          <sphereGeometry args={[0.68, 5, 4]} />{inner}
        </mesh>
        <mesh castShadow receiveShadow position={[-0.32, 0.26, -0.20]} scale={[0.55, 0.55, 0.55]}>
          <sphereGeometry args={[0.68, 5, 4]} />{outer}
        </mesh>
      </group>
    )
  }
  if (type === 1) {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]} scale={[0.78, 1.18, 0.78]}>
          <sphereGeometry args={[0.62, 6, 5]} />{inner}
        </mesh>
        <mesh castShadow receiveShadow position={[0.40, 0.78, 0.10]}>
          <sphereGeometry args={[0.42, 5, 4]} />{outer}
        </mesh>
        <mesh castShadow receiveShadow position={[-0.34, 0.68, -0.28]}>
          <sphereGeometry args={[0.38, 5, 4]} />{outer}
        </mesh>
        <mesh castShadow receiveShadow position={[0.08, 1.08, -0.10]}>
          <sphereGeometry args={[0.32, 5, 4]} />{outer}
        </mesh>
      </group>
    )
  }
  // type 2 – low spreading
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]} scale={[1.4, 0.45, 1.4]}>
        <sphereGeometry args={[0.68, 6, 4]} />{outer}
      </mesh>
      <mesh castShadow receiveShadow position={[0.58, 0.18, 0.30]} scale={[0.9, 0.38, 0.9]}>
        <sphereGeometry args={[0.68, 5, 4]} />{inner}
      </mesh>
      <mesh castShadow receiveShadow position={[-0.50, 0.18, -0.38]} scale={[0.85, 0.38, 0.85]}>
        <sphereGeometry args={[0.68, 5, 4]} />{outer}
      </mesh>
    </group>
  )
}

function Bushes({ palette, terrainSettings, globalSeed, worldShape }) {
  return (
    <group>
      {BUSHES.map((bush) => {
        let bx = bush.x
        let bz = bush.z
        let y  = sampleTerrainMeshHeight(bx, bz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        if (y < WATER_LEVEL + 0.15) {
          const dry = findDryLand(bx, bz, terrainSettings, globalSeed)
          bx = dry.x; bz = dry.z
          y  = sampleTerrainMeshHeight(bx, bz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        }
        const mapped = mapToWorld(bx, y, bz, worldShape)
        return (
          <group key={bush.id} position={mapped.position} quaternion={mapped.quaternion} scale={bush.scale}>
            <group rotation={[0, bush.rotation, 0]}>
              <BushModel type={bush.type} palette={palette} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

function Rocks({ palette, terrainSettings, globalSeed, worldShape }) {
  return (
    <group>
      {ROCKS.map((rock) => {
        let rx = rock.x
        let rz = rock.z
        let y = sampleTerrainMeshHeight(rx, rz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        if (y < WATER_LEVEL + 0.2) {
           const dryPos = findDryLand(rx, rz, terrainSettings, globalSeed)
           rx = dryPos.x
           rz = dryPos.z
           y = sampleTerrainMeshHeight(rx, rz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        }
        
        const mapped = mapToWorld(rx, y, rz, worldShape)

        return (
          <group
            key={rock.id}
            position={mapped.position}
            quaternion={mapped.quaternion}
            scale={rock.scale}
          >
            <group rotation={rock.rotation}>
              <RockModel type={rock.type} palette={palette} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

function WildGrass({ palette, terrainSettings, globalSeed, worldShape }) {
  const meshRef = useRef(null)

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mats = []

    for (let f = 0; f < 22; f++) {
      const fieldRadius = 5 + pseudoRandom(f * 11) * 10
      const fx = (pseudoRandom(f * 13) * 2 - 1) * (WORLD_RADIUS + 2)
      const fz = (pseudoRandom(f * 17) * 2 - 1) * (WORLD_RADIUS + 2)

      const bladeCount = Math.floor(fieldRadius * fieldRadius * 12)

      for (let b = 0; b < bladeCount; b++) {
        const bAngle = pseudoRandom(f * 1000 + b * 3) * Math.PI * 2
        const blobDistortion = 1 + Math.sin(bAngle * 3 + pseudoRandom(f) * 10) * 0.4
        const bRad = fieldRadius * Math.sqrt(pseudoRandom(f * 3000 + b * 11)) * blobDistortion

        const x = fx + Math.cos(bAngle) * bRad
        const z = fz + Math.sin(bAngle) * bRad

        if (Math.abs(x) > WORLD_RADIUS + 3 || Math.abs(z) > WORLD_RADIUS + 3) continue;

        let y = sampleTerrainMeshHeight(x, z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        
        if (y < WATER_LEVEL + 0.3) continue;

        const h = 0.15 + pseudoRandom(f * 4000 + b * 13) * 0.35
        const rx = (pseudoRandom(f * 5000 + b * 17) - 0.5) * 0.7
        const rz = (pseudoRandom(f * 6000 + b * 19) - 0.5) * 0.7
        const ry = pseudoRandom(f * 7000 + b * 23) * Math.PI * 2

        const mapped = mapToWorld(x, y + h * 0.1, z, worldShape)
        dummy.position.set(...mapped.position)
        dummy.quaternion.copy(mapped.quaternion)
        
        const localQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
        dummy.quaternion.multiply(localQuat)

        dummy.scale.set(0.04 + pseudoRandom(b * 2) * 0.02, h, 0.04 + pseudoRandom(b * 3) * 0.02)
        dummy.updateMatrix()

        mats.push(dummy.matrix.clone())
      }
    }
    return mats
  }, [terrainSettings, globalSeed, worldShape])

  useEffect(() => {
    if (meshRef.current) {
      matrices.forEach((matrix, i) => {
        meshRef.current.setMatrixAt(i, matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, matrices.length]}
      castShadow
      receiveShadow
    >
      <coneGeometry args={[1, 1, 3]} />
      <meshStandardMaterial color={palette.patch} flatShading roughness={0.8} />
    </instancedMesh>
  )
}

function EdgeFence({ palette, terrainSettings, globalSeed, worldShape }) {
  const posts = useMemo(
    () =>
      Array.from({ length: FENCE_POST_COUNT }, (_, index) => {
        const t = index / FENCE_POST_COUNT
        const side = Math.floor(t * 4)
        const localT = (t * 4) % 1

        let x, z
        if (side === 0) {
          x = -FENCE_RADIUS + localT * 2 * FENCE_RADIUS
          z = -FENCE_RADIUS
        } else if (side === 1) {
          x = FENCE_RADIUS
          z = -FENCE_RADIUS + localT * 2 * FENCE_RADIUS
        } else if (side === 2) {
          x = FENCE_RADIUS - localT * 2 * FENCE_RADIUS
          z = FENCE_RADIUS
        } else {
          x = -FENCE_RADIUS
          z = FENCE_RADIUS - localT * 2 * FENCE_RADIUS
        }

        return { id: `post-${index}`, x, z }
      }),
    [],
  )

  return (
    <group>
      {posts.map((post, index) => {
        const next = posts[(index + 1) % posts.length]
        const midX = (post.x + next.x) / 2
        const midZ = (post.z + next.z) / 2
        const dx = next.x - post.x
        const dz = next.z - post.z
        const segmentLength = Math.hypot(dx, dz)
        const segmentYaw = Math.atan2(dz, dx)
        
        const postY = sampleTerrainMeshHeight(post.x, post.z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        const railY = sampleTerrainMeshHeight(midX, midZ, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET

        const postMapped = mapToWorld(post.x, postY, post.z, worldShape)
        const railMapped = mapToWorld(midX, railY, midZ, worldShape)

        const railLocalQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -segmentYaw, 0))
        const railQuat = railMapped.quaternion.clone().multiply(railLocalQuat)

        return (
          <group key={post.id}>
            <group position={postMapped.position} quaternion={postMapped.quaternion}>
              <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
                <cylinderGeometry args={[0.15, 0.18, 1.7, 7]} />
                <meshStandardMaterial color="#6f5b43" roughness={0.95} />
              </mesh>
            </group>
            
            <group position={railMapped.position} quaternion={railQuat}>
              <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
                <boxGeometry args={[segmentLength * 0.92, 0.12, 0.12]} />
                <meshStandardMaterial color="#725f45" roughness={0.92} />
              </mesh>
              <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
                <boxGeometry args={[segmentLength * 0.92, 0.1, 0.1]} />
                <meshStandardMaterial color="#6b583f" roughness={0.92} />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}

function CameraRig({ cameraRef, controlsRef, focusTarget, palette, isInteractingRef, worldShape }) {
  const desiredTarget = useRef(new THREE.Vector3(0, 1.6, 0))
  const desiredPosition = useRef(new THREE.Vector3(...palette.cameraPosition))

  useEffect(() => {
    if (!focusTarget) {
      if (worldShape === 'globe') {
         desiredTarget.current.set(0, -GLOBE_RADIUS, 0)
         desiredPosition.current.set(palette.cameraPosition[0], palette.cameraPosition[1], palette.cameraPosition[2])
      } else {
         desiredTarget.current.set(0, 1.6, 0)
         desiredPosition.current.set(...palette.cameraPosition)
      }
      return
    }

    if (worldShape === 'globe') {
      const tMapped = mapToWorld(focusTarget.x, 1.8, focusTarget.z, worldShape)
      desiredTarget.current.set(tMapped.position[0], tMapped.position[1], tMapped.position[2])
      
      const normal = new THREE.Vector3(tMapped.position[0], tMapped.position[1] + GLOBE_RADIUS, tMapped.position[2]).normalize()
      desiredPosition.current.set(
        tMapped.position[0] + normal.x * 12 + normal.z * 10,
        tMapped.position[1] + normal.y * 12 + 4,
        tMapped.position[2] + normal.z * 12 - normal.x * 10
      )
    } else {
      desiredTarget.current.set(focusTarget.x, 1.8, focusTarget.z)
      desiredPosition.current.set(focusTarget.x + 12, 9, focusTarget.z + 12)
    }
  }, [focusTarget, palette, worldShape])

  useFrame((state, delta) => {
    if (!cameraRef.current) return

    // ── Hard floor: camera must never go below terrain surface ──
    const MIN_CAM_Y = worldShape === 'globe' ? -GLOBE_RADIUS + 3 : 1.2
    if (cameraRef.current.position.y < MIN_CAM_Y) {
      cameraRef.current.position.y = MIN_CAM_Y
    }

    if (!focusTarget || isInteractingRef.current) return

    cameraRef.current.position.x = THREE.MathUtils.damp(
      cameraRef.current.position.x,
      desiredPosition.current.x,
      2.3,
      delta,
    )
    cameraRef.current.position.y = THREE.MathUtils.damp(
      cameraRef.current.position.y,
      Math.max(MIN_CAM_Y, desiredPosition.current.y),
      2.3,
      delta,
    )
    cameraRef.current.position.z = THREE.MathUtils.damp(
      cameraRef.current.position.z,
      desiredPosition.current.z,
      2.3,
      delta,
    )

    if (controlsRef.current) {
      controlsRef.current.target.x = THREE.MathUtils.damp(
        controlsRef.current.target.x,
        desiredTarget.current.x,
        2.6,
        delta,
      )
      controlsRef.current.target.y = THREE.MathUtils.damp(
        controlsRef.current.target.y,
        desiredTarget.current.y,
        2.6,
        delta,
      )
      controlsRef.current.target.z = THREE.MathUtils.damp(
        controlsRef.current.target.z,
        desiredTarget.current.z,
        2.6,
        delta,
      )
      controlsRef.current.update()
    }
  })

  return null
}

// ── Keyboard camera pan (WASD / arrow keys) ───────────────────────────────────
const _fwd  = new THREE.Vector3()
const _rgt  = new THREE.Vector3()
const _move = new THREE.Vector3()
const _up   = new THREE.Vector3(0, 1, 0)

function KeyboardCameraController({ controlsRef, cameraRef }) {
  const keys = useRef(new Set())

  useEffect(() => {
    const onDown = e => keys.current.add(e.code)
    const onUp   = e => keys.current.delete(e.code)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!controlsRef.current || !cameraRef.current) return
    // Don’t steal keys while user is typing
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    const k = keys.current
    const fwd = k.has('KeyW') || k.has('ArrowUp')
    const bck = k.has('KeyS') || k.has('ArrowDown')
    const lft = k.has('KeyA') || k.has('ArrowLeft')
    const rgt = k.has('KeyD') || k.has('ArrowRight')
    if (!fwd && !bck && !lft && !rgt) return

    const speed = 14 * delta
    const cam   = cameraRef.current
    const ctrl  = controlsRef.current

    // Forward = direction from camera toward target, flattened to XZ
    _fwd.subVectors(ctrl.target, cam.position).setY(0).normalize()
    _rgt.crossVectors(_fwd, _up).normalize()

    _move.set(0, 0, 0)
    if (fwd) _move.addScaledVector(_fwd,  speed)
    if (bck) _move.addScaledVector(_fwd, -speed)
    if (lft) _move.addScaledVector(_rgt, -speed)
    if (rgt) _move.addScaledVector(_rgt,  speed)

    cam.position.add(_move)
    ctrl.target.add(_move)
    cam.position.y = Math.max(1.2, cam.position.y)
    ctrl.update()
  })

  return null
}

function HabitAreaShape({ area, terrainSettings, globalSeed, worldShape, hoveredAreaId }) {
  const geometry = useMemo(() => {
    const size = area.radius * 2 + 1
    const segments = Math.max(16, Math.floor(area.radius * 2.5))
    const geom = new THREE.PlaneGeometry(size, size, segments, segments)
    const pos = geom.attributes.position
    const colors = new Float32Array(pos.count * 4)

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i)
      const lz = -pos.getY(i)
      
      const x = area.centerX + lx
      const z = area.centerZ + lz

      const dist = Math.hypot(lx, lz)
      let alpha = 1.0
      if (dist > area.radius) {
        alpha = 0
      } else if (dist > area.radius - 0.2) {
        alpha = (area.radius - dist) / 0.2
      }

      const y = sampleTerrainMeshHeight(x, z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET + 0.14
      
      const mapped = mapToWorld(x, y, z, worldShape)
      pos.setXYZ(i, mapped.position[0], mapped.position[1], mapped.position[2])

      colors[i * 4] = 1
      colors[i * 4 + 1] = 1
      colors[i * 4 + 2] = 1
      colors[i * 4 + 3] = alpha
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    geom.computeVertexNormals()
    return geom
  }, [area, terrainSettings, globalSeed, worldShape])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={area.leafColor}
        transparent={true}
        vertexColors={true}
        opacity={hoveredAreaId === area.habitId ? 0.34 : 0.2}
        depthWrite={false}
      />
    </mesh>
  )
}

function HabitAreaBorder({ area, terrainSettings, globalSeed, worldShape }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const points = []
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      const x = area.centerX + Math.cos(angle) * area.radius
      const z = area.centerZ + Math.sin(angle) * area.radius
      const y = sampleTerrainMeshHeight(x, z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET + 0.18
      
      const mapped = mapToWorld(x, y, z, worldShape)
      points.push(mapped.position[0], mapped.position[1], mapped.position[2])
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geom
  }, [area, terrainSettings, globalSeed, worldShape])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={area.leafColor} />
    </line>
  )
}

function HabitAreas({
  areas,
  hoveredAreaId,
  onHoverArea,
  onLeaveArea,
  visible,
  onSelectArea,
  terrainSettings,
  globalSeed,
  worldShape,
}) {
  if (!visible) {
    return null
  }

  return (
    <group>
      {areas.map((area) => {
        const labelY = sampleTerrainMeshHeight(area.centerX, area.centerZ, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET + 1.4
        const labelMapped = mapToWorld(area.centerX, labelY, area.centerZ, worldShape)

        return (
          <group key={area.habitId}>
            <group
              onPointerOver={(event) => {
                event.stopPropagation()
                onHoverArea(area)
              }}
              onPointerOut={(event) => {
                event.stopPropagation()
                onLeaveArea()
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectArea(area)
              }}
            >
              <HabitAreaShape area={area} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} hoveredAreaId={hoveredAreaId} />
            </group>
            
            <HabitAreaBorder area={area} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
            

          </group>
        )
      })}
    </group>
  )
}

function SceneContents({
  habits,
  focusTarget,
  timeOfDay,
  viewMode,
  selectedTreeId,
  onTreeSelect,
  onAreaHover,
  terrainSettings,
  globalSeed,
}) {
  const worldShape = 'plane'   // globe mode removed
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const isInteractingRef = useRef(false)
  const [hoveredAreaId, setHoveredAreaId] = useState(null)
  const palette = interpolatePalette(timeOfDay)
  const areas = useMemo(
    () =>
      habits
        .filter((habit) => habit.trees.length > 0)
        .map((habit) => {
          const trees = habit.trees
          const centerX = trees.reduce((sum, tree) => sum + tree.x, 0) / trees.length
          const centerZ = trees.reduce((sum, tree) => sum + tree.z, 0) / trees.length
          const furthest = trees.reduce((maxRadius, tree) => {
            const distance = Math.hypot(tree.x - centerX, tree.z - centerZ)
            return Math.max(maxRadius, distance)
          }, 0)
          const uniqueDays = new Set(
            trees.map((tree) => new Date(tree.plantedAt).toDateString()),
          )

          return {
            habitId: habit.id,
            habitName: habit.name,
            leafColor: habit.species.leafColor,
            treeCount: trees.length,
            daysCompleted: uniqueDays.size,
            centerX,
            centerZ,
            radius: Math.max(4, furthest + 3.2),
          }
        }),
    [habits],
  )

  const allTrees = useMemo(() => habits.flatMap(h => h.trees), [habits])

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 60, 220]} />

      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={palette.cameraPosition}
        fov={58}
      />

      <CameraRig
        cameraRef={cameraRef}
        controlsRef={controlsRef}
        focusTarget={focusTarget}
        palette={palette}
        isInteractingRef={isInteractingRef}
        worldShape={worldShape}
      />

      <KeyboardCameraController controlsRef={controlsRef} cameraRef={cameraRef} />

      <ambientLight intensity={palette.ambient} color={palette.skyTint} />

      <directionalLight
        castShadow
        color={palette.sunColor}
        intensity={palette.sunIntensity}
        position={palette.sunPosition}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-left={-36}
        shadow-camera-right={36}
      />

      <hemisphereLight
        intensity={0.34}
        color={palette.skyTint}
        groundColor={palette.ground}
      />

      <Sky
        distance={400000}
        sunPosition={palette.sunPosition}
        inclination={0.52}
        azimuth={0.22}
        rayleigh={lerpN(1.9, 0.5, Math.max(0, (timeOfDay - 0.5) * 2))}
        turbidity={lerpN(7, 10, Math.max(0, (timeOfDay - 0.5) * 2))}
      />

      <SunDisc sunPosition={palette.sunPosition} sunColor={palette.sunColor} />

      <Sparkles
        count={timeOfDay > 0.75 ? 34 : 18}
        color={palette.sparkle}
        scale={[44, 12, 44]}
        position={[0, 4, 0]}
        size={2.8}
        speed={0.16}
        opacity={0.22}
      />

      <AmbientLife palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} allTrees={allTrees} habits={habits} worldShape={worldShape} />
      <Water worldShape={worldShape} />
      <WaterRipples worldShape={worldShape} />
      <Ground palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <WildGrass palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <Rocks  palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <Bushes palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <EdgeFence palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <HabitAreas
        areas={areas}
        hoveredAreaId={hoveredAreaId}
        onHoverArea={(area) => {
          setHoveredAreaId(area.habitId)
          onAreaHover?.(area)
        }}
        onLeaveArea={() => {
          setHoveredAreaId(null)
          onAreaHover?.(null)
        }}
        visible={viewMode === 'areas'}
        terrainSettings={terrainSettings}
        globalSeed={globalSeed}
        worldShape={worldShape}
        onSelectArea={(area) => {
          if (worldShape === 'globe') {
             const tMapped = mapToWorld(area.centerX, 1.8, area.centerZ, worldShape)
             controlsRef.current?.target.set(tMapped.position[0], tMapped.position[1], tMapped.position[2])
          } else {
             controlsRef.current?.target.set(area.centerX, 0.8, area.centerZ)
          }
          controlsRef.current?.update()
        }}
      />

      {habits.flatMap((habit) =>
        habit.trees.map((tree) => {
          let tx = tree.x
          let tz = tree.z
          let y = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET - TREE_GROUND_EMBED

          if (y < WATER_LEVEL + 0.3) {
            const dryPos = findDryLand(tx, tz, terrainSettings, globalSeed)
            tx = dryPos.x
            tz = dryPos.z
            y = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET - TREE_GROUND_EMBED
          }

          const mapped = mapToWorld(tx, y, tz, worldShape)

          return (
            <Tree
              key={tree.id}
              species={habit.species}
              tree={tree}
              mappedPosition={mapped.position}
              mappedQuaternion={mapped.quaternion}
              isSelected={selectedTreeId === tree.id}
              onSelect={() =>
                onTreeSelect?.({
                  treeId: tree.id,
                  habitId: habit.id,
                  habitName: habit.name,
                  plantedAt: tree.plantedAt,
                  treeCount: habit.trees.length,
                  daysCompleted: new Set(
                    habit.trees.map((item) => new Date(item.plantedAt).toDateString()),
                  ).size,
                  streak:    getHabitStreak(habit),
                  milestone: getMilestone(habit.trees.length),
                  position: { x: tx, z: tz },
                  species: {
                    canopyType: habit.species.canopyType,
                    leafColor:  habit.species.leafColor,
                    barkColor:  habit.species.barkColor,
                  },
                })
              }
            />
          )
        }),
      )}

      <OrbitControls
        ref={controlsRef}
        onStart={() => {
          isInteractingRef.current = true
        }}
        onEnd={() => {
          isInteractingRef.current = false
        }}
        enablePan={worldShape !== 'globe'}
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.11}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        panSpeed={0.85}
        maxPolarAngle={Math.PI * 0.455}  // ~82° — keeps camera above the terrain
        minPolarAngle={Math.PI / 10}
        minDistance={worldShape === 'globe' ? GLOBE_RADIUS + 5 : 7}
        maxDistance={worldShape === 'globe' ? GLOBE_RADIUS + 60 : 120}
        screenSpacePanning={false}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
    </>
  )
}

function ForestScene({
  habits,
  focusTarget,
  timeOfDay,
  viewMode,
  selectedTreeId,
  onTreeSelect,
  onAreaHover,
  terrainSettings,
  globalSeed,
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
      className="absolute inset-0"
      onPointerMissed={() => {
        onTreeSelect?.(null)
      }}
    >
      <SceneContents
        habits={habits}
        focusTarget={focusTarget}
        timeOfDay={timeOfDay}
        viewMode={viewMode}
        selectedTreeId={selectedTreeId}
        onTreeSelect={onTreeSelect}
        onAreaHover={onAreaHover}
        terrainSettings={terrainSettings}
        globalSeed={globalSeed}
      />
    </Canvas>
  )
}

export default ForestScene
