import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, PerspectiveCamera, Sparkles } from '@react-three/drei'
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
  WATER_LEVEL,
  findDryLand,
  getHabitStreak,
  getMilestone,
} from '../lib/forest'

const TERRAIN_Y_OFFSET = -0.18
// Shared static geometries to prevent reinstantiation overhead
const sharedDodecGeom = new THREE.DodecahedronGeometry(1, 0)
const sharedIcoGeom = new THREE.IcosahedronGeometry(1, 0)
const sharedOctaGeom = new THREE.OctahedronGeometry(1, 0)
const sharedSphereGeom = new THREE.SphereGeometry(1, 6, 5)
const TREE_GROUND_EMBED = 0.22
const FENCE_RADIUS = WORLD_RADIUS + 4.5
const FENCE_POST_COUNT = 56

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const ROCKS = Array.from({ length: 70 }, (_, index) => {
  const angle = pseudoRandom(index * 7 + 5) * Math.PI * 2
  const radius = Math.sqrt(pseudoRandom(index * 13 + 7)) * 52.0
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius

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

const BUSHES = Array.from({ length: 125 }, (_, index) => {
  const angle = pseudoRandom(index * 7 + 3) * Math.PI * 2
  const radius = Math.sqrt(pseudoRandom(index * 11 + 9)) * 48.0
  return {
    id: `bush-${index}`,
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    scale: 0.30 + pseudoRandom(index * 19) * 0.65,
    type: Math.floor(pseudoRandom(index * 29) * 3),
    rotation: pseudoRandom(index * 37) * Math.PI * 2,
  }
})


const PALETTE = {
  background: '#5da9ef',
  fog: '#b6e0ff',
  ambient: 1.1,
  sunIntensity: 1.5,
  sunColor: '#fff5d8',
  sunPosition: [22, 28, 10],
  skyTint: '#d8efff',
  ground: '#5f7e4b',
  patch: '#95b27b',
  rock: '#8c9288',
  sparkle: '#e8f4d4',
  cameraPosition: [45, 26, 45],
}

// ── Sky dome with vibrant blue gradient unaffected by fog ─────────────────────
function SkyDome({ topColor = '#5da9ef', bottomColor = '#b6e0ff' }) {
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color(topColor) },
    bottomColor: { value: new THREE.Color(bottomColor) },
    offset: { value: 30 },
    exponent: { value: 0.8 },
  }), [topColor, bottomColor])

  return (
    <mesh renderOrder={-2}>
      <sphereGeometry args={[480, 32, 24]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          }
        `}
      />
    </mesh>
  )
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

function Ground({ palette, terrainSettings, globalSeed, worldShape, onPointerMove, onClick }) {
  const terrainGeometry = useMemo(() => {
    const size = (WORLD_RADIUS + TERRAIN_PADDING) * 2
    const segments = TERRAIN_SEGMENTS
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    const positions = geometry.attributes.position
    const colors = new Float32Array(positions.count * 4)

    // Height-based palette for natural island, sandy beach, and submerged ocean floor
    const cDeepBed = new THREE.Color('#133c4a').convertSRGBToLinear()
    const cShallowBed = new THREE.Color('#38797c').convertSRGBToLinear()
    const cWetSand = new THREE.Color('#b89f66').convertSRGBToLinear()
    const cBeach = new THREE.Color('#d4bf7d').convertSRGBToLinear()
    const cShore = new THREE.Color('#8fa46a').convertSRGBToLinear()
    const cLowland = new THREE.Color(palette.ground).convertSRGBToLinear()
    const cMeadow = new THREE.Color(palette.patch).convertSRGBToLinear()
    const cHighland = new THREE.Color(palette.rock).convertSRGBToLinear()
    const color = new THREE.Color()

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = -positions.getY(index)
      const y = getTerrainHeight(x, z, terrainSettings, globalSeed) || 0

      const mapped = mapToWorld(x, y, z, worldShape)
      positions.setXYZ(index, mapped.position[0], mapped.position[1], mapped.position[2])

      const dist = Math.hypot(x, z)
      let alpha = 1.0
      if (dist > 76) {
        alpha = Math.max(0, 1.0 - (dist - 76) / 10)
      }

      // Approximate slope for rocky cliffs
      const eps = 1.2
      const dy_dx = (getTerrainHeight(x + eps, z, terrainSettings, globalSeed) - y) / eps
      const dy_dz = (getTerrainHeight(x, z + eps, terrainSettings, globalSeed) - y) / eps
      const slope = Math.min(1, Math.sqrt(dy_dx * dy_dx + dy_dz * dy_dz) * 1.8)

      // Per-vertex noise for organic grass variation
      const nv = (Math.sin(x * 0.21 + 1.4) * Math.cos(z * 0.18 - 0.7)) * 0.18

      // Height zone thresholds
      const wl = WATER_LEVEL // -0.3
      if (y < -2.4) {
        color.copy(cDeepBed)
      } else if (y < -0.85) {
        const t = (y - (-2.4)) / 1.55
        color.copy(cDeepBed).lerp(cShallowBed, t)
      } else if (y < wl - 0.04) {
        const t = (y - (-0.85)) / (wl - 0.04 - (-0.85))
        color.copy(cShallowBed).lerp(cWetSand, t)
      } else if (y < wl + 0.10) {
        const t = Math.max(0, Math.min(1, (y - (wl - 0.04)) / 0.14))
        color.copy(cWetSand).lerp(cBeach, t)
      } else if (y < wl + 0.25) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.10)) / 0.15))
        color.copy(cBeach).lerp(cShore, t)
      } else if (y < wl + 0.45 + nv) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.25)) / 0.20))
        color.copy(cShore).lerp(cLowland, t)
      } else if (y < 0.85 + nv) {
        const t = Math.max(0, Math.min(1, (y - (wl + 0.45)) / 0.70))
        color.copy(cLowland).lerp(cMeadow, t)
      } else if (y < 1.45 + nv) {
        const t = Math.max(0, Math.min(1, (y - 0.85) / 0.60))
        color.copy(cMeadow).lerp(cHighland, t * 0.85)
      } else {
        color.copy(cHighland)
      }

      // Steep slopes above water → rocky cliffs
      if (slope > 0.30 && y > wl) {
        color.lerp(cHighland, Math.min(1, (slope - 0.30) / 0.45))
      }

      colors[index * 4] = color.r
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
        onPointerMove={onPointerMove}
        onClick={onClick}
      >
        <meshStandardMaterial vertexColors={true} roughness={1} transparent={true} alphaTest={0.05} />
      </mesh>
    </group>
  )
}

function Water({ palette }) {
  const meshRef = useRef(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepWaterColor: { value: new THREE.Color('#135472') },
    uMidWaterColor: { value: new THREE.Color('#218da7') },
    uShallowWaterColor: { value: new THREE.Color('#3fc9bc') },
    uSunPosition: { value: new THREE.Vector3(...(palette?.sunPosition || [22, 28, 10])).normalize() },
    uSunColor: { value: new THREE.Color(palette?.sunColor || '#fff5d8') },
    uFogColor: { value: new THREE.Color(palette?.fog || '#b6e0ff') },
  }), [palette])

  useFrame(({ clock }) => {
    if (meshRef.current?.material?.uniforms) {
      meshRef.current.material.uniforms.uTime.value = clock.elapsedTime
    }
  })

  const waterGeometry = useMemo(() => {
    return new THREE.CircleGeometry(560, 96)
  }, [])

  useEffect(() => {
    return () => {
      waterGeometry.dispose()
    }
  }, [waterGeometry])

  return (
    <mesh
      ref={meshRef}
      geometry={waterGeometry}
      position={[0, WATER_LEVEL + TERRAIN_Y_OFFSET, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <shaderMaterial
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          varying vec2 vUv;
          uniform float uTime;

          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);

            // Subtle, calm surface swell
            float w1 = sin(worldPos.x * 0.08 + uTime * 0.7) * cos(worldPos.z * 0.08 + uTime * 0.6) * 0.035;
            float w2 = sin(worldPos.x * 0.16 - uTime * 0.9 + worldPos.z * 0.12) * 0.015;
            float totalWave = w1 + w2;

            worldPos.y += totalWave;
            vWorldPosition = worldPos.xyz;

            float dw_dx = cos(worldPos.x * 0.08 + uTime * 0.7) * cos(worldPos.z * 0.08 + uTime * 0.6) * 0.08 * 0.035;
            float dw_dz = -sin(worldPos.x * 0.08 + uTime * 0.7) * sin(worldPos.z * 0.08 + uTime * 0.6) * 0.08 * 0.035;
            vNormal = normalize(vec3(-dw_dx, 1.0, -dw_dz));

            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          uniform vec3 uDeepWaterColor;
          uniform vec3 uMidWaterColor;
          uniform vec3 uShallowWaterColor;
          uniform vec3 uSunPosition;
          uniform vec3 uSunColor;
          uniform vec3 uFogColor;
          uniform float uTime;

          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          varying vec2 vUv;

          void main() {
            float dist = length(vWorldPosition.xz);

            // Smooth depth gradient: crystal turquoise in shallows/inland -> mid azure -> deep open ocean
            vec3 waterColor = uDeepWaterColor;
            float alpha = 0.94;

            if (dist < 54.0) {
              waterColor = uShallowWaterColor;
              alpha = 0.80;
            } else if (dist < 78.0) {
              float t = (dist - 54.0) / 24.0;
              waterColor = mix(uShallowWaterColor, uMidWaterColor, t);
              alpha = mix(0.80, 0.91, t);
            } else if (dist < 120.0) {
              float t = (dist - 78.0) / 42.0;
              waterColor = mix(uMidWaterColor, uDeepWaterColor, t);
              alpha = mix(0.91, 0.95, t);
            }

            // Gentle sun reflection specular highlight
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            vec3 lightDir = normalize(uSunPosition);
            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(vNormal, halfDir), 0.0), 38.0);
            waterColor += uSunColor * spec * 0.5;

            // Delicate surface caustics shimmer
            float shimmer = sin(vWorldPosition.x * 1.2 + uTime * 1.1) * cos(vWorldPosition.z * 1.2 - uTime * 0.9);
            if (shimmer > 0.80) {
              waterColor += vec3(0.06, 0.09, 0.11) * ((shimmer - 0.80) * 3.0);
            }

            // Atmospheric horizon fog blend
            if (dist > 160.0) {
              float fogFactor = smoothstep(160.0, 420.0, dist);
              waterColor = mix(waterColor, uFogColor, fogFactor * 0.95);
              alpha = mix(alpha, 1.0, fogFactor);
            }

            gl_FragColor = vec4(waterColor, alpha);
          }
        `}
      />
    </mesh>
  )
}

function RockModel({ type, palette }) {
  const material = <meshStandardMaterial color={palette.rock} flatShading roughness={0.95} />

  if (type === 0) {
    // Wide, flat rock outcrop
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, -0.6, 0]} scale={[1.6, 1.2, 1.4]} geometry={sharedDodecGeom}>
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[0.8, -0.8, -0.5]} scale={[1.0, 1.0, 1.1]} geometry={sharedIcoGeom}>
          {material}
        </mesh>
      </group>
    )
  }

  if (type === 1) {
    // Cluster of jagged rocks
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, -0.5, 0]} scale={[0.9, 1.5, 0.9]} rotation={[0.2, 0.4, 0.1]} geometry={sharedIcoGeom}>
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[0.7, -0.8, 0.4]} scale={[0.7, 1.2, 0.8]} rotation={[-0.3, 0.1, -0.2]} geometry={sharedOctaGeom}>
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[-0.6, -0.7, -0.3]} scale={[0.8, 1.0, 0.7]} rotation={[0.1, -0.4, 0.2]} geometry={sharedDodecGeom}>
          {material}
        </mesh>
      </group>
    )
  }

  // Blocky, massive buried boulder
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -1.0, 0]} scale={[1.4, 1.8, 1.3]} rotation={[0.4, 0, 0.3]} geometry={sharedOctaGeom}>
        {material}
      </mesh>
      <mesh castShadow receiveShadow position={[-0.5, -0.8, 0.6]} scale={[1.1, 1.4, 1.1]} rotation={[0, 0.6, 0]} geometry={sharedDodecGeom}>
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
        <mesh castShadow receiveShadow position={[0, 0.48, 0]} scale={[0.68, 0.68 * 0.88, 0.68]} geometry={sharedSphereGeom}>{outer}</mesh>
        <mesh castShadow receiveShadow position={[0.38, 0.30, 0.22]} scale={[0.68 * 0.6, 0.68 * 0.6, 0.68 * 0.6]} geometry={sharedSphereGeom}>{inner}</mesh>
        <mesh castShadow receiveShadow position={[-0.32, 0.26, -0.20]} scale={[0.68 * 0.55, 0.68 * 0.55, 0.68 * 0.55]} geometry={sharedSphereGeom}>{outer}</mesh>
      </group>
    )
  }
  if (type === 1) {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]} scale={[0.62 * 0.78, 0.62 * 1.18, 0.62 * 0.78]} geometry={sharedSphereGeom}>{inner}</mesh>
        <mesh castShadow receiveShadow position={[0.40, 0.78, 0.10]} scale={[0.42, 0.42, 0.42]} geometry={sharedSphereGeom}>{outer}</mesh>
        <mesh castShadow receiveShadow position={[-0.34, 0.68, -0.28]} scale={[0.38, 0.38, 0.38]} geometry={sharedSphereGeom}>{outer}</mesh>
        <mesh castShadow receiveShadow position={[0.08, 1.08, -0.10]} scale={[0.32, 0.32, 0.32]} geometry={sharedSphereGeom}>{outer}</mesh>
      </group>
    )
  }
  // type 2 – low spreading
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]} scale={[0.68 * 1.4, 0.68 * 0.45, 0.68 * 1.4]} geometry={sharedSphereGeom}>{outer}</mesh>
      <mesh castShadow receiveShadow position={[0.58, 0.18, 0.30]} scale={[0.68 * 0.9, 0.68 * 0.38, 0.68 * 0.9]} geometry={sharedSphereGeom}>{inner}</mesh>
      <mesh castShadow receiveShadow position={[-0.50, 0.18, -0.38]} scale={[0.68 * 0.85, 0.68 * 0.38, 0.68 * 0.85]} geometry={sharedSphereGeom}>{outer}</mesh>
    </group>
  )
}

function Bushes({ palette, terrainSettings, globalSeed, worldShape }) {
  return (
    <group>
      {BUSHES.map((bush) => {
        let bx = bush.x
        let bz = bush.z
        let y = sampleTerrainMeshHeight(bx, bz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
        if (y < WATER_LEVEL + 0.15) {
          const dry = findDryLand(bx, bz, terrainSettings, globalSeed)
          bx = dry.x; bz = dry.z
          y = sampleTerrainMeshHeight(bx, bz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
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

    for (let f = 0; f < 36; f++) {
      const fieldRadius = 4 + pseudoRandom(f * 11) * 8
      const fieldAngle = pseudoRandom(f * 13) * Math.PI * 2
      const fieldDist = Math.sqrt(pseudoRandom(f * 17)) * 42.0
      const fx = Math.cos(fieldAngle) * fieldDist
      const fz = Math.sin(fieldAngle) * fieldDist

      const bladeCount = Math.floor(fieldRadius * fieldRadius * 12)

      for (let b = 0; b < bladeCount; b++) {
        const bAngle = pseudoRandom(f * 1000 + b * 3) * Math.PI * 2
        const blobDistortion = 1 + Math.sin(bAngle * 3 + pseudoRandom(f) * 10) * 0.4
        const bRad = fieldRadius * Math.sqrt(pseudoRandom(f * 3000 + b * 11)) * blobDistortion

        const x = fx + Math.cos(bAngle) * bRad
        const z = fz + Math.sin(bAngle) * bRad

        if (Math.hypot(x, z) > 52) continue;

        let y = sampleTerrainMeshHeight(x, z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET

        if (y < WATER_LEVEL + 0.3) continue;

        const h = 0.15 + pseudoRandom(f * 4000 + b * 13) * 0.35
        const rx = (pseudoRandom(f * 5000 + b * 17) - 0.5) * 0.7
        const rz = (pseudoRandom(f * 6000 + b * 19) - 0.5) * 0.7
        const ry = pseudoRandom(f * 7000 + b * 23) * Math.PI * 2

        // ConeGeometry height is centered at 0. Offset by h/2 so it sits on the ground.
        const mapped = mapToWorld(x, y + h * 0.5, z, worldShape)
        dummy.position.set(...mapped.position)
        dummy.quaternion.copy(mapped.quaternion)

        const localQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
        dummy.quaternion.multiply(localQuat)

        dummy.scale.set(0.03 + pseudoRandom(b * 2) * 0.02, h, 0.03 + pseudoRandom(b * 3) * 0.02)
        dummy.updateMatrix()

        mats.push(dummy.matrix.clone())
      }
    }
    return mats
  }, [terrainSettings, globalSeed, worldShape])

  useEffect(() => {
    if (meshRef.current && matrices.length > 0) {
      matrices.forEach((matrix, i) => {
        meshRef.current.setMatrixAt(i, matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true

      // CRITICAL: Compute bounding volumes so frustum culling works correctly
      // when zooming in or looking away from the origin.
      meshRef.current.computeBoundingSphere()
      if (meshRef.current.computeBoundingBox) meshRef.current.computeBoundingBox()
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
      <meshStandardMaterial color={palette.patch} flatShading roughness={0.8} side={THREE.DoubleSide} />
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
function AnimatedCampfire({ isPreview, poleMat, fireMat }) {
  const fireRef = useRef(null)
  const lightRef = useRef(null)
  const smokeRef = useRef(null)

  // Pre-calculate smoke properties
  const smokeParticles = useMemo(() => {
    return Array.from({ length: 8 }, () => ({
      x: (Math.random() - 0.5) * 0.2,
      y: Math.random() * 0.8 + 0.2,
      z: (Math.random() - 0.5) * 0.2,
      speed: Math.random() * 0.008 + 0.005,
      scale: Math.random() * 0.4 + 0.4,
      phase: Math.random() * Math.PI * 2
    }))
  }, [])

  useFrame((state) => {
    if (isPreview) return
    const t = state.clock.elapsedTime

    // Flicker fire cone
    if (fireRef.current) {
      fireRef.current.scale.set(
        1 + Math.sin(t * 15) * 0.1,
        1 + Math.sin(t * 20) * 0.15,
        1 + Math.sin(t * 12) * 0.1
      )
    }

    // Flicker point light intensity
    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(t * 18) * 0.3 + Math.sin(t * 7) * 0.2
    }

    // Animate smoke
    if (smokeRef.current) {
      smokeRef.current.children.forEach((child, i) => {
        const p = smokeParticles[i]
        child.position.y += p.speed
        child.position.x += Math.sin(t * 2 + p.phase) * 0.003

        // fade by shrinking
        const life = 1 - (child.position.y - 0.2) / 1.5
        if (life > 0) {
          child.scale.setScalar(p.scale * life)
        } else {
          // reset particle
          child.position.y = 0.2
          child.position.x = (Math.random() - 0.5) * 0.2
          child.position.z = (Math.random() - 0.5) * 0.2
          child.scale.setScalar(p.scale)
        }
      })
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Rocks Base */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.05, 0]}>
        <dodecahedronGeometry args={[0.3, 0]} />
        {poleMat}
      </mesh>

      {/* Fire */}
      <mesh ref={fireRef} position={[0, 0.2, 0]}>
        <coneGeometry args={[0.2, 0.4, 4]} />
        {fireMat}
      </mesh>

      {/* Light */}
      {!isPreview && (
        <pointLight ref={lightRef} position={[0, 0.5, 0]} color="#ffaa00" intensity={2} distance={8} decay={2} />
      )}

      {/* Smoke */}
      {!isPreview && (
        <group ref={smokeRef}>
          {smokeParticles.map((p, i) => (
            <mesh key={i} position={[p.x, p.y, p.z]}>
              <sphereGeometry args={[0.12, 4, 4]} />
              <meshBasicMaterial color="#555" transparent opacity={0.2} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function Tent({ position, rotation, color, isPreview }) {
  const transparent = isPreview
  const opacity = isPreview ? 0.6 : 1

  const tentMat = <meshStandardMaterial color={color} roughness={0.9} flatShading transparent={transparent} opacity={opacity} />
  const darkMat = <meshBasicMaterial color="#1f1f1f" transparent={transparent} opacity={opacity} />
  const poleMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={transparent} opacity={opacity} />

  const Pole = ({ rotZ, z }) => (
    <group position={[0, 1.15, z]} rotation={[0, 0, rotZ]}>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, -0.75, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.7, 5]} />
        {poleMat}
      </mesh>
    </group>
  )

  return (
    <group position={position} rotation={rotation}>
      {/* Main Tent Body */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 1.8, 3]} />
        {tentMat}
      </mesh>

      {/* Entrance Hole (Dark Triangle) */}
      <mesh position={[0, 0.35, -0.91]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.02, 3]} />
        {darkMat}
      </mesh>

      {/* Front Poles (-Z face) */}
      <Pole rotZ={Math.PI / 6} z={-0.95} />
      <Pole rotZ={-Math.PI / 6} z={-0.95} />

      {/* Back Poles (+Z face) */}
      <Pole rotZ={Math.PI / 6} z={0.95} />
      <Pole rotZ={-Math.PI / 6} z={0.95} />

      {/* Top Ridge Pole */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 5]} />
        {poleMat}
      </mesh>
    </group>
  )
}

function Campsite({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const transparent = isPreview

  const fireMat = <meshBasicMaterial color="#ff9900" transparent={transparent} opacity={opacity} />
  const poleMat = <meshStandardMaterial color="#444" roughness={0.9} flatShading transparent={transparent} opacity={opacity} />

  return (
    <group>
      <AnimatedCampfire isPreview={isPreview} poleMat={poleMat} fireMat={fireMat} />
      <Tent position={[-1.5, 0, 1.5]} rotation={[0, -Math.PI / 4, 0]} color="#c2634e" isPreview={isPreview} />
      <Tent position={[1.5, 0, 1.5]} rotation={[0, Math.PI / 4, 0]} color="#4e9cc2" isPreview={isPreview} />
    </group>
  )
}

function PicnicTable({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#6a4b35" roughness={0.9} flatShading transparent={isPreview} opacity={opacity} />

  return (
    <group>
      {/* Table Top */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.6, 0]}>
        <boxGeometry args={[1.6, 0.1, 0.8]} />
        {woodMat}
      </mesh>
      {/* Legs */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[-0.6, 0.3, 0]}>
        <boxGeometry args={[0.1, 0.6, 1.4]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0.6, 0.3, 0]}>
        <boxGeometry args={[0.1, 0.6, 1.4]} />
        {woodMat}
      </mesh>
      {/* Bench 1 */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.35, 0.6]}>
        <boxGeometry args={[1.6, 0.1, 0.3]} />
        {woodMat}
      </mesh>
      {/* Bench 2 */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.35, -0.6]}>
        <boxGeometry args={[1.6, 0.1, 0.3]} />
        {woodMat}
      </mesh>
    </group>
  )
}

function LanternPost({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const metalMat = <meshStandardMaterial color="#222" roughness={0.6} transparent={isPreview} opacity={opacity} />
  const glassMat = <meshBasicMaterial color="#ffeeb0" transparent={isPreview} opacity={opacity} />

  return (
    <group>
      {/* Main Pole */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.6, 5]} />
        {woodMat}
      </mesh>
      {/* Arm */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0.3, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 4]} />
        {woodMat}
      </mesh>
      {/* Lantern Cap */}
      <mesh position={[0.5, 1.4, 0]}>
        <coneGeometry args={[0.15, 0.15, 4]} />
        {metalMat}
      </mesh>
      {/* Lantern Body */}
      <mesh position={[0.5, 1.25, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 4]} />
        {glassMat}
      </mesh>
      {/* Lantern Base */}
      <mesh position={[0.5, 1.13, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 4]} />
        {metalMat}
      </mesh>
      {!isPreview && (
        <pointLight position={[0.5, 1.25, 0]} color="#ffeeb0" intensity={1.5} distance={12} decay={2} />
      )}
    </group>
  )
}

function Birdhouse({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const poleMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const houseMat = <meshStandardMaterial color="#8e9968" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const roofMat = <meshStandardMaterial color="#c2634e" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const holeMat = <meshBasicMaterial color="#1f1f1f" transparent={isPreview} opacity={opacity} />

  return (
    <group>
      {/* Pole */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 2.0, 5]} />
        {poleMat}
      </mesh>
      {/* House Body */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.2, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {houseMat}
      </mesh>
      {/* Roof */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.5, 0.3, 4]} />
        {roofMat}
      </mesh>
      {/* Hole */}
      <mesh position={[0, 2.2, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        {holeMat}
      </mesh>
      {/* Perch */}
      <mesh castShadow={!isPreview} position={[0, 2.05, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.15, 4]} />
        {poleMat}
      </mesh>
    </group>
  )
}

function Gazebo({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#5a422b" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const roofMat = <meshStandardMaterial color="#354a3c" roughness={0.8} transparent={isPreview} opacity={opacity} flatShading />
  const floorMat = <meshStandardMaterial color="#4a3b2c" roughness={1.0} transparent={isPreview} opacity={opacity} />
  const lightMat = <meshBasicMaterial color="#ffddaa" transparent={isPreview} opacity={opacity} />

  const pillars = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const px = Math.cos(angle) * 1.8
    const pz = Math.sin(angle) * 1.8
    pillars.push(
      <mesh key={i} castShadow={!isPreview} receiveShadow={!isPreview} position={[px, 1.5, pz]}>
        <cylinderGeometry args={[0.08, 0.08, 3.0, 4]} />
        {woodMat}
      </mesh>
    )
  }

  return (
    <group>
      {/* Base Floor */}
      <mesh receiveShadow={!isPreview} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.2, 8]} />
        {floorMat}
      </mesh>

      {pillars}

      {/* Roof Base */}
      <mesh castShadow={!isPreview} position={[0, 3.1, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.2, 8]} />
        {woodMat}
      </mesh>

      {/* Roof Dome */}
      <mesh castShadow={!isPreview} position={[0, 4.1, 0]}>
        <coneGeometry args={[2.4, 2.0, 8]} />
        {roofMat}
      </mesh>

      {/* Center Lantern */}
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        {lightMat}
      </mesh>
      {!isPreview && (
        <pointLight position={[0, 2.6, 0]} color="#ffddaa" intensity={2} distance={15} decay={2} />
      )}
    </group>
  )
}

function Windmill({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#888" roughness={0.9} transparent={isPreview} opacity={opacity} flatShading />
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const sailMat = <meshStandardMaterial color="#e0dfd5" roughness={1.0} transparent={isPreview} opacity={opacity} side={THREE.DoubleSide} />

  const sailsRef = useRef(null)

  useFrame((state, delta) => {
    if (!isPreview && sailsRef.current) {
      sailsRef.current.rotation.z += delta * 0.5 // Slow continuous rotation
    }
  })

  const sails = []
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    sails.push(
      <group key={i} rotation={[0, 0, angle]}>
        {/* Sail arm */}
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.1, 3.6, 0.1]} />
          {woodMat}
        </mesh>
        {/* Sail fabric */}
        <mesh position={[0.4, 2.2, 0]} rotation={[0, 0.2, 0]}>
          <planeGeometry args={[0.7, 2.8]} />
          {sailMat}
        </mesh>
      </group>
    )
  }

  return (
    <group>
      {/* Main Tower */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.5, 0]}>
        <cylinderGeometry args={[1.2, 1.8, 5.0, 8]} />
        {stoneMat}
      </mesh>

      {/* Tower Roof */}
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 5.8, 0]}>
        <coneGeometry args={[1.4, 1.6, 8]} />
        {woodMat}
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.8, 1.65]}>
        <boxGeometry args={[0.8, 1.6, 0.2]} />
        {woodMat}
      </mesh>

      {/* Rotating Sails Assembly */}
      <group position={[0, 5.0, 1.3]}>
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.6, 8]} />
          {woodMat}
        </mesh>
        {/* The rotating part */}
        <group ref={sailsRef} position={[0, 0, 0.3]}>
          {sails}
        </group>
      </group>
    </group>
  )
}

function StonePath({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#889988" roughness={1.0} transparent={isPreview} opacity={opacity} flatShading />
  return (
    <group>
      <mesh receiveShadow={!isPreview} position={[0, 0.05, 0]} rotation={[0, Math.random(), 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 6]} />
        {stoneMat}
      </mesh>
    </group>
  )
}

function LogSeat({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={1.0} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      {/* Supports */}
      <mesh castShadow={!isPreview} position={[-0.4, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 6]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0.4, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 6]} />
        {woodMat}
      </mesh>
      {/* Main Log */}
      <mesh castShadow={!isPreview} position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.2, 8]} />
        {woodMat}
      </mesh>
    </group>
  )
}

function FlowerBed({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const soilMat = <meshStandardMaterial color="#2d1f14" roughness={1.0} transparent={isPreview} opacity={opacity} />
  const pinkMat = <meshStandardMaterial color="#ff7eb3" roughness={0.6} transparent={isPreview} opacity={opacity} />
  const yellowMat = <meshStandardMaterial color="#ffde59" roughness={0.6} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 0.2, 0.6]} />
        {woodMat}
      </mesh>
      <mesh position={[0, 0.21, 0]}>
        <boxGeometry args={[1.2, 0.05, 0.4]} />
        {soilMat}
      </mesh>
      <mesh position={[-0.4, 0.28, 0.1]}><sphereGeometry args={[0.1, 4, 4]} />{pinkMat}</mesh>
      <mesh position={[0, 0.3, -0.05]}><sphereGeometry args={[0.12, 4, 4]} />{yellowMat}</mesh>
      <mesh position={[0.3, 0.25, 0.05]}><sphereGeometry args={[0.08, 4, 4]} />{pinkMat}</mesh>
      <mesh position={[0.5, 0.3, -0.1]}><sphereGeometry args={[0.1, 4, 4]} />{yellowMat}</mesh>
      <mesh position={[-0.2, 0.25, -0.1]}><sphereGeometry args={[0.1, 4, 4]} />{pinkMat}</mesh>
    </group>
  )
}

function Well({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#888" roughness={0.9} transparent={isPreview} opacity={opacity} flatShading />
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const roofMat = <meshStandardMaterial color="#354a3c" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const waterMat = <meshStandardMaterial color="#3b82f6" transparent={isPreview || true} opacity={isPreview ? 0.6 : 0.8} />

  return (
    <group>
      <mesh castShadow={!isPreview} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.8, 8]} />
        {stoneMat}
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 8]} />
        {waterMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[-0.5, 1.2, 0]}>
        <boxGeometry args={[0.1, 1.6, 0.1]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0.5, 1.2, 0]}>
        <boxGeometry args={[0.1, 1.6, 0.1]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.9, 0.6, 4]} />
        {roofMat}
      </mesh>
      <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
        {woodMat}
      </mesh>
    </group>
  )
}

function Watchtower({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const floorMat = <meshStandardMaterial color="#5a422b" roughness={1.0} transparent={isPreview} opacity={opacity} />

  return (
    <group>
      <mesh castShadow={!isPreview} position={[-0.8, 2.5, -0.8]} rotation={[-0.05, 0, 0.05]}><cylinderGeometry args={[0.1, 0.15, 5, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0.8, 2.5, -0.8]} rotation={[-0.05, 0, -0.05]}><cylinderGeometry args={[0.1, 0.15, 5, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[-0.8, 2.5, 0.8]} rotation={[0.05, 0, 0.05]}><cylinderGeometry args={[0.1, 0.15, 5, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0.8, 2.5, 0.8]} rotation={[0.05, 0, -0.05]}><cylinderGeometry args={[0.1, 0.15, 5, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 4.8, 0]}><boxGeometry args={[2.4, 0.2, 2.4]} />{floorMat}</mesh>
      <mesh position={[0, 5.2, -1.15]}><boxGeometry args={[2.4, 0.1, 0.1]} />{woodMat}</mesh>
      <mesh position={[0, 5.2, 1.15]}><boxGeometry args={[2.4, 0.1, 0.1]} />{woodMat}</mesh>
      <mesh position={[-1.15, 5.2, 0]}><boxGeometry args={[0.1, 0.1, 2.4]} />{woodMat}</mesh>
      <mesh position={[1.15, 5.2, 0]}><boxGeometry args={[0.1, 0.1, 2.4]} />{woodMat}</mesh>
      <mesh position={[-1.15, 5.0, -1.15]}><boxGeometry args={[0.1, 0.4, 0.1]} />{woodMat}</mesh>
      <mesh position={[1.15, 5.0, -1.15]}><boxGeometry args={[0.1, 0.4, 0.1]} />{woodMat}</mesh>
      <mesh position={[-1.15, 5.0, 1.15]}><boxGeometry args={[0.1, 0.4, 0.1]} />{woodMat}</mesh>
      <mesh position={[1.15, 5.0, 1.15]}><boxGeometry args={[0.1, 0.4, 0.1]} />{woodMat}</mesh>
      <mesh position={[0, 2.4, 1.1]} rotation={[-0.1, 0, 0]}><boxGeometry args={[0.6, 5.2, 0.05]} />{floorMat}</mesh>
    </group>
  )
}

function GiantCrystal({ isPreview }) {
  const opacity = isPreview ? 0.4 : 0.85
  const crystalGlowMat = <meshBasicMaterial color="#d48fff" transparent opacity={isPreview ? 0.2 : 0.4} />

  const crystalRef = useRef(null)
  const lightRef = useRef(null)

  useFrame((state) => {
    if (!isPreview && crystalRef.current) {
      const t = state.clock.elapsedTime
      crystalRef.current.position.y = 2.0 + Math.sin(t) * 0.2
      if (lightRef.current) {
        lightRef.current.intensity = 2 + Math.sin(t * 2) * 0.5
      }
    }
  })

  return (
    <group>
      <group ref={crystalRef} position={[0, 2.0, 0]}>
        <mesh castShadow={!isPreview}>
          <octahedronGeometry args={[1.4, 0]} />
          <meshStandardMaterial color="#c060ff" roughness={0.1} metalness={0.5} transparent opacity={opacity} flatShading />
        </mesh>
        <mesh scale={1.1}>
          <octahedronGeometry args={[1.4, 0]} />
          {crystalGlowMat}
        </mesh>
      </group>
      <mesh position={[1.2, 0.8, 0.5]} rotation={[0.4, 0.5, 0.2]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#c060ff" roughness={0.1} metalness={0.5} transparent opacity={opacity} flatShading />
      </mesh>
      <mesh position={[-1.0, 0.5, -0.8]} rotation={[-0.4, -0.5, 0.6]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#c060ff" roughness={0.1} metalness={0.5} transparent opacity={opacity} flatShading />
      </mesh>
      {!isPreview && (
        <pointLight ref={lightRef} position={[0, 2.0, 0]} color="#d48fff" intensity={2} distance={20} decay={2} />
      )}
    </group>
  )
}




function MushroomPatch({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stemMat = <meshStandardMaterial color="#eeeeee" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const capMat = <meshStandardMaterial color="#ff3333" roughness={0.7} transparent={isPreview} opacity={opacity} />

  const Shroom = ({ pos, scale }) => (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.04, 0.06, 0.4, 6]} />{stemMat}</mesh>
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />{capMat}</mesh>
    </group>
  )

  return (
    <group>
      <Shroom pos={[0, 0, 0]} scale={1.2} />
      <Shroom pos={[0.3, 0, 0.2]} scale={0.8} />
      <Shroom pos={[-0.2, 0, 0.3]} scale={0.6} />
      <Shroom pos={[-0.3, 0, -0.2]} scale={1.0} />
    </group>
  )
}

function WoodenFence({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[-0.9, 0.4, 0]}><cylinderGeometry args={[0.06, 0.06, 0.8, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0.9, 0.4, 0]}><cylinderGeometry args={[0.06, 0.06, 0.8, 4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 0.6, 0]}><boxGeometry args={[2.0, 0.1, 0.05]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 0.3, 0]}><boxGeometry args={[2.0, 0.1, 0.05]} />{woodMat}</mesh>
    </group>
  )
}

function Statue({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#7a7a7a" roughness={0.9} flatShading transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[0, 0.3, 0]} rotation={[0, 0.2, 0]}><cylinderGeometry args={[0.5, 0.6, 0.6, 6]} />{stoneMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 0.9, 0]} rotation={[0, -0.4, 0]}><cylinderGeometry args={[0.4, 0.45, 0.6, 5]} />{stoneMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 1.4, 0]} rotation={[0.1, 0.5, 0]}><cylinderGeometry args={[0.25, 0.3, 0.5, 6]} />{stoneMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 1.8, 0]} rotation={[-0.1, 0.1, 0.1]}><sphereGeometry args={[0.2, 6, 6]} />{stoneMat}</mesh>
    </group>
  )
}

function Hammock({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const fabricMat = <meshStandardMaterial color="#f0a868" roughness={1.0} transparent={isPreview} opacity={opacity} side={THREE.DoubleSide} />
  const ropeMat = <meshStandardMaterial color="#dddddd" roughness={0.9} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[-1.2, 0.8, 0]} rotation={[0, 0, -0.2]}><cylinderGeometry args={[0.06, 0.08, 1.6, 5]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[1.2, 0.8, 0]} rotation={[0, 0, 0.2]}><cylinderGeometry args={[0.06, 0.08, 1.6, 5]} />{woodMat}</mesh>
      <mesh position={[0, 0.6, 0]} scale={[1.8, 0.4, 0.8]}><sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />{fabricMat}</mesh>
      <mesh position={[-1.05, 0.95, 0]} rotation={[0, 0, -1.2]}><cylinderGeometry args={[0.02, 0.02, 0.4]} />{ropeMat}</mesh>
      <mesh position={[1.05, 0.95, 0]} rotation={[0, 0, 1.2]}><cylinderGeometry args={[0.02, 0.02, 0.4]} />{ropeMat}</mesh>
    </group>
  )
}

function Fountain({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#b0b0b0" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const waterMat = <meshStandardMaterial color="#44aaff" roughness={0.1} transparent opacity={isPreview ? 0.5 : 0.7} />
  return (
    <group>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.2, 0]}><cylinderGeometry args={[1.5, 1.6, 0.4, 12]} />{stoneMat}</mesh>
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[1.4, 1.4, 0.1, 12]} />{waterMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 0.8, 0]}><cylinderGeometry args={[0.3, 0.5, 0.8, 8]} />{stoneMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 1.2, 0]}><cylinderGeometry args={[0.8, 0.9, 0.2, 8]} />{stoneMat}</mesh>
      <mesh position={[0, 1.25, 0]}><cylinderGeometry args={[0.75, 0.75, 0.1, 8]} />{waterMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 1.6, 0]}><cylinderGeometry args={[0.15, 0.25, 0.6, 8]} />{stoneMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 1.9, 0]}><cylinderGeometry args={[0.4, 0.45, 0.2, 8]} />{stoneMat}</mesh>
      <mesh position={[0, 1.95, 0]}><cylinderGeometry args={[0.35, 0.35, 0.1, 8]} />{waterMat}</mesh>
      <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />{waterMat}</mesh>
    </group>
  )
}

function ToriGate({ isPreview }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#d94838" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const blackMat = <meshStandardMaterial color="#222222" roughness={0.8} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[-1.6, 2.0, 0]} rotation={[0, 0, 0.05]}><cylinderGeometry args={[0.15, 0.2, 4.0, 8]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[1.6, 2.0, 0]} rotation={[0, 0, -0.05]}><cylinderGeometry args={[0.15, 0.2, 4.0, 8]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[-1.7, 0.2, 0]}><boxGeometry args={[0.6, 0.4, 0.6]} />{blackMat}</mesh>
      <mesh castShadow={!isPreview} position={[1.7, 0.2, 0]}><boxGeometry args={[0.6, 0.4, 0.6]} />{blackMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 3.8, 0]}><boxGeometry args={[4.4, 0.3, 0.4]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 3.1, 0]}><boxGeometry args={[3.8, 0.2, 0.3]} />{woodMat}</mesh>
      <mesh castShadow={!isPreview} position={[0, 3.45, 0]}><boxGeometry args={[0.2, 0.5, 0.35]} />{woodMat}</mesh>
    </group>
  )
}

function ItemWrapper({ fixedPos, isPreview, previewPosRef, placementRotationRef, keysDownRef, terrainSettings, globalSeed, worldShape, placementItem, onRemoveItem, children }) {
  const groupRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  // Calculate static position once for placed items
  const staticPos = useMemo(() => {
    if (isPreview || !fixedPos) return { position: [0, -1000, 0], quaternion: new THREE.Quaternion() }

    let tx = fixedPos.x
    let tz = fixedPos.z
    let rot = fixedPos.rotation || 0

    let ty = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
    const mapped = mapToWorld(tx, ty, tz, worldShape)

    // Apply item Y rotation
    const yRotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot)
    mapped.quaternion.multiply(yRotQuat)

    return mapped
  }, [fixedPos, isPreview, terrainSettings, globalSeed, worldShape])

  useFrame((state, delta) => {
    if (isPreview && groupRef.current && previewPosRef.current) {
      if (keysDownRef?.current?.['e'] || keysDownRef?.current?.['r']) {
        placementRotationRef.current += delta * 2.5
      }
      if (keysDownRef?.current?.['q']) {
        placementRotationRef.current -= delta * 2.5
      }

      let tx = previewPosRef.current.x
      let tz = previewPosRef.current.z
      let rot = placementRotationRef?.current || 0

      let ty = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
      const mapped = mapToWorld(tx, ty, tz, worldShape)

      // Apply placement Y rotation
      const yRotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot)
      mapped.quaternion.multiply(yRotQuat)

      groupRef.current.position.set(mapped.position[0], mapped.position[1], mapped.position[2])
      groupRef.current.quaternion.copy(mapped.quaternion)
    }
  })

  return (
    <group
      ref={groupRef}
      position={staticPos.position}
      quaternion={staticPos.quaternion}
      onPointerOver={(e) => {
        if (!isPreview && !placementItem && onRemoveItem) {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={(e) => {
        if (!isPreview) {
          e.stopPropagation()
          setHovered(false)
          document.body.style.cursor = 'default'
        }
      }}
      onClick={(e) => {
        if (!isPreview && hovered && onRemoveItem) {
          e.stopPropagation()
          onRemoveItem(fixedPos)
          setHovered(false)
          document.body.style.cursor = 'default'
        }
      }}
    >
      {hovered && (
        <Html position={[0, 2, 0]} center>
          <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none">
            ✕ Click to Remove
          </div>
        </Html>
      )}
      <group scale={hovered ? 1.05 : 1}>
        {children}
      </group>
    </group>
  )
}

function ShopItemRender({ item, terrainSettings, globalSeed, worldShape, isPreview, previewPosRef, placementRotationRef, keysDownRef, placementItem, onRemoveItem }) {
  const props = { isPreview }

  let content = null
  switch (item.type) {
    case 'stone_path': content = <StonePath {...props} />; break;
    case 'wooden_fence': content = <WoodenFence {...props} />; break;
    case 'mushroom_patch': content = <MushroomPatch {...props} />; break;
    case 'log_seat': content = <LogSeat {...props} />; break;
    case 'flower_bed': content = <FlowerBed {...props} />; break;
    case 'lantern_post': content = <LanternPost {...props} />; break;
    case 'picnic_table': content = <PicnicTable {...props} />; break;
    case 'statue': content = <Statue {...props} />; break;
    case 'hammock': content = <Hammock {...props} />; break;
    case 'birdhouse': content = <Birdhouse {...props} />; break;
    case 'campsite': content = <Campsite {...props} />; break;
    case 'well': content = <Well {...props} />; break;
    case 'gazebo': content = <Gazebo {...props} />; break;
    case 'fountain': content = <Fountain {...props} />; break;
    case 'watchtower': content = <Watchtower {...props} />; break;
    case 'tori_gate': content = <ToriGate {...props} />; break;
    case 'windmill': content = <Windmill {...props} />; break;
    case 'crystal': content = <GiantCrystal {...props} />; break;
    default: return null
  }

  return (
    <ItemWrapper
      fixedPos={item}
      isPreview={isPreview}
      previewPosRef={previewPosRef}
      placementRotationRef={placementRotationRef}
      keysDownRef={keysDownRef}
      placementItem={placementItem}
      onRemoveItem={onRemoveItem}
      terrainSettings={terrainSettings}
      globalSeed={globalSeed}
      worldShape={worldShape}
    >
      {content}
    </ItemWrapper>
  )
}

function CameraRig({ cameraRef, controlsRef, focusTarget, palette, isInteractingRef, worldShape }) {
  const desiredPosition = useRef(new THREE.Vector3(45, 26, 45))
  const desiredTarget   = useRef(new THREE.Vector3(0, 0.8, 0))

  useEffect(() => {
    if (!focusTarget) {
      desiredTarget.current.set(0, 0.8, 0)
      desiredPosition.current.set(45, 26, 45)
      return
    }

    desiredTarget.current.set(focusTarget.x, 1.8, focusTarget.z)
    desiredPosition.current.set(focusTarget.x + 12, 9, focusTarget.z + 12)
  }, [focusTarget, palette])

  useFrame((state, stateDelta) => {
    if (!cameraRef.current) return

    // ── Hard floor: camera must never go below terrain surface ──
    const MIN_CAM_Y = 1.2
    if (cameraRef.current.position.y < MIN_CAM_Y) {
      cameraRef.current.position.y = MIN_CAM_Y
    }

    if (!focusTarget || isInteractingRef.current) return

    cameraRef.current.position.x = THREE.MathUtils.damp(
      cameraRef.current.position.x,
      desiredPosition.current.x,
      2.3,
      stateDelta,
    )
    cameraRef.current.position.y = THREE.MathUtils.damp(
      cameraRef.current.position.y,
      Math.max(MIN_CAM_Y, desiredPosition.current.y),
      2.3,
      stateDelta,
    )
    cameraRef.current.position.z = THREE.MathUtils.damp(
      cameraRef.current.position.z,
      desiredPosition.current.z,
      2.3,
      stateDelta,
    )

    if (controlsRef.current) {
      controlsRef.current.target.x = THREE.MathUtils.damp(
        controlsRef.current.target.x,
        desiredTarget.current.x,
        2.6,
        stateDelta,
      )
      controlsRef.current.target.y = THREE.MathUtils.damp(
        controlsRef.current.target.y,
        desiredTarget.current.y,
        2.6,
        stateDelta,
      )
      controlsRef.current.target.z = THREE.MathUtils.damp(
        controlsRef.current.target.z,
        desiredTarget.current.z,
        2.6,
        stateDelta,
      )
      controlsRef.current.update()
    }
  })

  return null
}

// ── Keyboard camera pan (WASD / arrow keys) ───────────────────────────────────
const _fwd = new THREE.Vector3()
const _rgt = new THREE.Vector3()
const _move = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

function KeyboardCameraController({ controlsRef, cameraRef }) {
  const keys = useRef(new Set())

  useEffect(() => {
    const onDown = e => keys.current.add(e.code)
    const onUp = e => keys.current.delete(e.code)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!controlsRef.current || !cameraRef.current) return
    // Don't steal keys while user is typing
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    const k = keys.current
    const fwd = k.has('KeyW') || k.has('ArrowUp')
    const bck = k.has('KeyS') || k.has('ArrowDown')
    const lft = k.has('KeyA') || k.has('ArrowLeft')
    const rgt = k.has('KeyD') || k.has('ArrowRight')
    const rotL = k.has('KeyQ')      // Rotate left/orbit counter-clockwise
    const rotR = k.has('KeyE')      // Rotate right/orbit clockwise
    const rotU = k.has('KeyI')      // Rotate up (pitch up)
    const rotD = k.has('KeyK')      // Rotate down (pitch down)

    if (!fwd && !bck && !lft && !rgt && !rotL && !rotR && !rotU && !rotD) return

    const speed = 14 * delta
    const rotSpeed = 1.2 * delta
    const cam = cameraRef.current
    const ctrl = controlsRef.current

    // Handle orbit rotation
    if (rotL || rotR || rotU || rotD) {
      const spherical = new THREE.Spherical()
      spherical.setFromVector3(cam.position.clone().sub(ctrl.target))

      if (rotL) {
        spherical.theta -= rotSpeed
      }
      if (rotR) {
        spherical.theta += rotSpeed
      }
      if (rotU) {
        spherical.phi = Math.max(Math.PI / 10, Math.min(Math.PI * 0.455, spherical.phi - rotSpeed))
      }
      if (rotD) {
        spherical.phi = Math.max(Math.PI / 10, Math.min(Math.PI * 0.455, spherical.phi + rotSpeed))
      }

      const newPosition = new THREE.Vector3()
      newPosition.setFromSpherical(spherical)
      newPosition.add(ctrl.target)

      cam.position.copy(newPosition)
      ctrl.update()
    }

    // Handle movement (WASD)
    if (fwd || bck || lft || rgt) {
      // Forward = direction from camera toward target, flattened to XZ
      _fwd.subVectors(ctrl.target, cam.position).setY(0).normalize()
      _rgt.crossVectors(_fwd, _up).normalize()

      _move.set(0, 0, 0)
      if (fwd) _move.addScaledVector(_fwd, speed)
      if (bck) _move.addScaledVector(_fwd, -speed)
      if (lft) _move.addScaledVector(_rgt, -speed)
      if (rgt) _move.addScaledVector(_rgt, speed)

      cam.position.add(_move)
      ctrl.target.add(_move)
      cam.position.y = Math.max(1.2, cam.position.y)
      ctrl.update()
    }
  })

  return null
}

// ── Organic blob helper ───────────────────────────────────────────────────────
// Each tree broadcasts its distance across ±SPREAD neighbouring sectors using
// a cosine falloff (no single tree creates a spike). Then many passes of a
// wide box-blur round out the envelope completely, and gentle low-frequency
// noise adds an organic wobble without spikiness.
function buildBlobRadii(trees, cx, cz, sectors, padding, noiseAmp, noiseFreq) {
  const raw = new Float32Array(sectors)

  // ── 1. Broadcast each tree's radius to nearby sectors ──────────────────────
  // Narrower SPREAD than before so the blob still tracks the cluster shape.
  const SPREAD = Math.ceil(sectors / 14)   // ~5 sectors each side — half as wide as before
  for (const t of trees) {
    const dx = t.x - cx
    const dz = t.z - cz
    const dist = Math.hypot(dx, dz)
    const angle = Math.atan2(dz, dx)
    const fBucket = ((angle / (Math.PI * 2)) * sectors % sectors + sectors) % sectors
    const center = Math.floor(fBucket)

    for (let s = -SPREAD; s <= SPREAD; s++) {
      const idx = ((center + s) % sectors + sectors) % sectors
      const weight = Math.cos((s / (SPREAD + 1)) * Math.PI * 0.5)
      raw[idx] = Math.max(raw[idx], dist * weight)
    }
  }

  // ── 2. Fill empty sectors from neighbours ──────────────────────────────────
  let minR = Infinity
  for (let i = 0; i < sectors; i++) if (raw[i] > 0) minR = Math.min(minR, raw[i])
  if (!isFinite(minR)) minR = 0
  for (let i = 0; i < sectors; i++) if (raw[i] === 0) raw[i] = minR

  // ── 3. Light smoothing — just enough to remove hard kinks ─────────────────
  // 5 passes of a 5-tap kernel: smooths without collapsing the shape.
  const BLUR_PASSES = 5
  const HALF = 2   // 5-tap: -2 … +2
  const W = []
  let wSum = 0
  for (let k = -HALF; k <= HALF; k++) {
    const w = Math.cos((k / (HALF + 1)) * Math.PI * 0.5)
    W.push(w); wSum += w
  }
  for (let k = 0; k < W.length; k++) W[k] /= wSum

  let buf = new Float32Array(raw)
  const tmp = new Float32Array(sectors)
  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    for (let i = 0; i < sectors; i++) {
      let v = 0
      for (let k = 0; k < W.length; k++) {
        v += buf[((i + k - HALF) % sectors + sectors) % sectors] * W[k]
      }
      tmp[i] = v
    }
    buf.set(tmp)
  }

  // ── 4. Padding + gentle organic noise ──────────────────────────────────────
  for (let i = 0; i < sectors; i++) {
    const angle = (i / sectors) * Math.PI * 2
    const noise =
      Math.sin(angle * noiseFreq) * noiseAmp +
      Math.sin(angle * noiseFreq * 1.7 + 0.9) * noiseAmp * 0.4
    buf[i] = Math.max(1.0, buf[i] + padding + noise)
  }

  return buf
}

function HabitAreaShape({ area, terrainSettings, globalSeed, worldShape, hoveredAreaIdRef }) {
  const fillMatRef = useRef(null)

  useFrame((state) => {
    if (!fillMatRef.current) return
    const isHov = hoveredAreaIdRef.current === area.habitId
    const base = isHov ? 0.38 : 0.22
    const pulse = isHov ? Math.sin(state.clock.elapsedTime * 2.4) * 0.07 : 0
    fillMatRef.current.opacity = base + pulse
  })

  const geometry = useMemo(() => {
    const { centerX: cx, centerZ: cz, trees } = area
    const SECTORS = 72
    const PAD = 6.0           // generous wrap-around padding
    // Gentle, large-scale noise seeded per habit for organic uniqueness
    const seedVal = area.habitId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const noiseAmp = 0.25 + (seedVal % 5) * 0.04   // 0.25 – 0.41  (subtle)
    const noiseFreq = 2 + (seedVal % 3)           // 2 – 4         (low freq only)

    const radii = buildBlobRadii(trees, cx, cz, SECTORS, PAD, noiseAmp, noiseFreq)

    // Build a triangulated fan from the centre outward
    // Each sector becomes 2 triangles with a sub-division ring at 60 % so the
    // fill looks smooth over undulating terrain.
    const positions = []
    const colorArr = []

    function pushVertex(wx, wz, alpha) {
      const wy = sampleTerrainMeshHeight(wx, wz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET + 0.14
      const m = mapToWorld(wx, wy, wz, worldShape)
      positions.push(...m.position)
      colorArr.push(1, 1, 1, alpha)
    }

    for (let i = 0; i < SECTORS; i++) {
      const a0 = (i / SECTORS) * Math.PI * 2
      const a1 = ((i + 1) / SECTORS) * Math.PI * 2
      const r0 = radii[i]
      const r1 = radii[(i + 1) % SECTORS]
      const rMid = (r0 + r1) / 2 * 0.6   // inner ring radius

      // 4 points: centre, inner-left, inner-right, outer-left, outer-right
      const innerL = { x: cx + Math.cos(a0) * rMid, z: cz + Math.sin(a0) * rMid }
      const innerR = { x: cx + Math.cos(a1) * rMid, z: cz + Math.sin(a1) * rMid }
      const outerL = { x: cx + Math.cos(a0) * r0, z: cz + Math.sin(a0) * r0 }
      const outerR = { x: cx + Math.cos(a1) * r1, z: cz + Math.sin(a1) * r1 }

      // Tri 1: centre → innerL → innerR
      pushVertex(cx, cz, 1.0)
      pushVertex(innerL.x, innerL.z, 1.0)
      pushVertex(innerR.x, innerR.z, 1.0)

      // Tri 2: innerL → outerL → innerR
      pushVertex(innerL.x, innerL.z, 1.0)
      pushVertex(outerL.x, outerL.z, 0.0)
      pushVertex(innerR.x, innerR.z, 1.0)

      // Tri 3: outerL → outerR → innerR
      pushVertex(outerL.x, outerL.z, 0.0)
      pushVertex(outerR.x, outerR.z, 0.0)
      pushVertex(innerR.x, innerR.z, 1.0)
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 4))
    geom.computeVertexNormals()
    return geom
  }, [area, terrainSettings, globalSeed, worldShape])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={fillMatRef}
        color={area.leafColor}
        transparent={true}
        vertexColors={true}
        opacity={0.22}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

const _WHITE = new THREE.Color(1, 1, 1)

function HabitAreaBorder({ area, terrainSettings, globalSeed, worldShape, hoveredAreaIdRef }) {
  const innerMatRef = useRef(null)
  const outerMatRef = useRef(null)
  const glowT = useRef(0)
  const baseColor = useMemo(() => new THREE.Color(area.leafColor), [area.leafColor])

  const geometry = useMemo(() => {
    const { centerX: cx, centerZ: cz, trees } = area
    const SECTORS = 72
    const PAD = 6.0
    const seedVal = area.habitId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const noiseAmp = 0.25 + (seedVal % 5) * 0.04
    const noiseFreq = 2 + (seedVal % 3)

    const radii = buildBlobRadii(trees, cx, cz, SECTORS, PAD, noiseAmp, noiseFreq)

    const points = []
    for (let i = 0; i <= SECTORS; i++) {
      const idx = i % SECTORS
      const angle = (idx / SECTORS) * Math.PI * 2
      const r = radii[idx]
      const wx = cx + Math.cos(angle) * r
      const wz = cz + Math.sin(angle) * r
      const wy = sampleTerrainMeshHeight(wx, wz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET + 0.20
      const m = mapToWorld(wx, wy, wz, worldShape)
      points.push(...m.position)
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geom
  }, [area, terrainSettings, globalSeed, worldShape])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state, delta) => {
    const isHov = hoveredAreaIdRef.current === area.habitId
    glowT.current = THREE.MathUtils.damp(glowT.current, isHov ? 1 : 0, 5, delta)
    const g = glowT.current

    if (innerMatRef.current) {
      innerMatRef.current.color.copy(baseColor).lerp(_WHITE, g * 0.5)
      innerMatRef.current.opacity = 0.75 + g * 0.25
    }

    if (outerMatRef.current) {
      const pulse = isHov
        ? 0.5 + Math.sin(state.clock.elapsedTime * 3.2) * 0.3
        : 0
      outerMatRef.current.opacity = g * pulse
    }
  })

  return (
    <group>
      {/* Primary border */}
      <line geometry={geometry}>
        <lineBasicMaterial ref={innerMatRef} color={area.leafColor} transparent opacity={0.75} />
      </line>
      {/* Glow halo — same geometry, slightly elevated */}
      <line geometry={geometry}>
        <lineBasicMaterial ref={outerMatRef} color="white" transparent opacity={0} depthWrite={false} />
      </line>
    </group>
  )
}

function HabitAreas({
  areas,
  hoveredAreaIdRef,
  onAreaHover,
  onSelectArea,
  visible,
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
                hoveredAreaIdRef.current = area.habitId
                onAreaHover?.(area)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={(event) => {
                event.stopPropagation()
                hoveredAreaIdRef.current = null
                onAreaHover?.(null)
                document.body.style.cursor = 'default'
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectArea(area)
              }}
            >
              <HabitAreaShape area={area} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} hoveredAreaIdRef={hoveredAreaIdRef} />
            </group>

            <HabitAreaBorder area={area} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} hoveredAreaIdRef={hoveredAreaIdRef} />


          </group>
        )
      })}
    </group>
  )
}

function SceneContents({
  habits,
  focusTarget,
  viewMode,
  selectedTreeId,
  onTreeSelect,
  onAreaHover,
  terrainSettings,
  globalSeed,
  inventory,
  placementItem,
  onPlaceItem,
  onRemoveItem,
}) {
  const worldShape = 'plane'   // globe mode removed
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const isInteractingRef = useRef(false)
  const hoveredAreaIdRef = useRef(null)
  // Defer selection so terrain-heavy tree reconciliation doesn't block the click response
  const deferredSelectedTreeId = useDeferredValue(selectedTreeId)
  const palette = PALETTE
  const previewPosRef = useRef(null)
  const placementRotationRef = useRef(0)
  const keysDownRef = useRef({})

  useEffect(() => {
    if (!placementItem) return

    const handleKeyDown = (e) => {
      keysDownRef.current[e.key.toLowerCase()] = true
    }
    const handleKeyUp = (e) => {
      keysDownRef.current[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [placementItem])

  const handlePointerMove = useCallback((e) => {
    if (placementItem) {
      e.stopPropagation()
      previewPosRef.current = { x: e.point.x, z: e.point.z }
    }
  }, [placementItem])

  const handlePointerClick = useCallback((e) => {
    if (placementItem && previewPosRef.current) {
      e.stopPropagation()
      onPlaceItem(placementItem, previewPosRef.current.x, previewPosRef.current.z, placementRotationRef.current)
      previewPosRef.current = null
      placementRotationRef.current = 0
    }
  }, [placementItem, onPlaceItem])
  const areas = useMemo(
    () =>
      habits
        .filter((habit) => habit.trees.length > 0)
        .map((habit) => {
          // Resolve each tree to its actual rendered position (water → dry land)
          const resolvedTrees = habit.trees.map((tree) => {
            let tx = tree.x
            let tz = tree.z
            const ty = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET - TREE_GROUND_EMBED
            if (ty < WATER_LEVEL + 0.3) {
              const dry = findDryLand(tx, tz, terrainSettings, globalSeed)
              tx = dry.x
              tz = dry.z
            }
            return { x: tx, z: tz }
          })

          const centerX = resolvedTrees.reduce((s, t) => s + t.x, 0) / resolvedTrees.length
          const centerZ = resolvedTrees.reduce((s, t) => s + t.z, 0) / resolvedTrees.length
          const furthest = resolvedTrees.reduce((mx, t) =>
            Math.max(mx, Math.hypot(t.x - centerX, t.z - centerZ)), 0)

          const uniqueDays = new Set(
            habit.trees.map((tree) => new Date(tree.plantedAt).toDateString()),
          )

          return {
            habitId: habit.id,
            habitName: habit.name,
            leafColor: habit.species.leafColor,
            treeCount: resolvedTrees.length,
            daysCompleted: uniqueDays.size,
            centerX,
            centerZ,
            radius: Math.max(4, furthest + 3.2),
            trees: resolvedTrees,   // actual rendered positions for blob shape
          }
        }),
    [habits, terrainSettings, globalSeed],
  )

  const allTrees = useMemo(() => habits.flatMap(h => h.trees), [habits])

  // Pre-compute every tree's world position once — keyed only on terrain/habits,
  // NOT on selectedTreeId or viewMode, so clicking a tree never retriggers this.
  const resolvedTrees = useMemo(() =>
    habits.flatMap((habit) =>
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
        return { habit, tree, tx, tz, mapped }
      })
    ),
    [habits, terrainSettings, globalSeed, worldShape],
  )

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 100, 320]} />

      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={palette.cameraPosition}
        fov={58}
        near={0.1}
        far={1000}
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
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
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

      <SkyDome topColor="#5da9ef" bottomColor="#b6e0ff" />

      <SunDisc sunPosition={palette.sunPosition} sunColor={palette.sunColor} />

      <Sparkles
        count={28}
        color={palette.sparkle}
        scale={[72, 14, 72]}
        position={[0, 4, 0]}
        size={2.8}
        speed={0.16}
        opacity={0.22}
      />

      <AmbientLife palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} habits={habits} />
      <Water palette={palette} />
      <Ground palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} onPointerMove={handlePointerMove} onClick={handlePointerClick} />
      <WildGrass palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <Rocks palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
      <Bushes palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />

      {inventory?.filter(i => typeof i === 'object').map((item) => (
        <ShopItemRender
          key={item.id}
          item={item}
          terrainSettings={terrainSettings}
          globalSeed={globalSeed}
          worldShape={worldShape}
          placementItem={placementItem}
          onRemoveItem={onRemoveItem}
        />
      ))}

      {placementItem && (
        <ShopItemRender item={{ type: placementItem }} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} isPreview previewPosRef={previewPosRef} placementRotationRef={placementRotationRef} keysDownRef={keysDownRef} />
      )}

      <HabitAreas
        areas={areas}
        hoveredAreaIdRef={hoveredAreaIdRef}
        onAreaHover={onAreaHover}
        visible={viewMode === 'areas'}
        terrainSettings={terrainSettings}
        globalSeed={globalSeed}
        worldShape={worldShape}
        onSelectArea={(area) => {
          controlsRef.current?.target.set(area.centerX, 0.8, area.centerZ)
          controlsRef.current?.update()
        }}
      />

      {resolvedTrees.map(({ habit, tree, tx, tz, mapped }) => {
        const inAreaView = viewMode === 'areas'

        return (
          <Tree
            key={tree.id}
            species={habit.species}
            tree={tree}
            mappedPosition={mapped.position}
            isSelected={!inAreaView && deferredSelectedTreeId === tree.id}
            interactive={!inAreaView}
            onSelect={inAreaView ? undefined : () =>
              onTreeSelect?.({
                treeId: tree.id,
                habitId: habit.id,
                habitName: habit.name,
                plantedAt: tree.plantedAt,
                treeCount: habit.trees.length,
                daysCompleted: new Set(
                  habit.trees.map((item) => new Date(item.plantedAt).toDateString()),
                ).size,
                streak: getHabitStreak(habit),
                milestone: getMilestone(habit.trees.length),
                position: { x: tx, z: tz },
                species: {
                  canopyType: habit.species.canopyType,
                  leafColor: habit.species.leafColor,
                  barkColor: habit.species.barkColor,
                },
              })
            }
          />
        )
      })
      }

      <OrbitControls
        ref={controlsRef}
        onStart={() => {
          isInteractingRef.current = true
        }}
        onEnd={() => {
          isInteractingRef.current = false
        }}
        enablePan={true}
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.11}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        panSpeed={0.85}
        maxPolarAngle={Math.PI * 0.455}  // ~82° — keeps camera above the terrain
        minPolarAngle={Math.PI / 10}
        minDistance={7}
        maxDistance={180}
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
  viewMode,
  selectedTreeId,
  onTreeSelect,
  onAreaHover,
  terrainSettings,
  globalSeed,
  inventory,
  placementItem,
  onPlaceItem,
  onRemoveItem,
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className={`absolute inset-0 ${placementItem ? 'cursor-crosshair' : ''}`}
      onPointerMissed={() => {
        onTreeSelect?.(null)
      }}
    >
      <SceneContents
        habits={habits}
        focusTarget={focusTarget}
        viewMode={viewMode}
        selectedTreeId={selectedTreeId}
        onTreeSelect={onTreeSelect}
        onAreaHover={onAreaHover}
        terrainSettings={terrainSettings}
        globalSeed={globalSeed}
        inventory={inventory || []}
        placementItem={placementItem}
        onPlaceItem={onPlaceItem}
        onRemoveItem={onRemoveItem}
      />
    </Canvas>
  )
}

export default ForestScene
