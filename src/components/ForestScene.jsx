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

function Ground({ palette, terrainSettings }) {
  const terrainGeometry = useMemo(() => {
    const size = (WORLD_RADIUS + TERRAIN_PADDING) * 2
    const segments = TERRAIN_SEGMENTS
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    const positions = geometry.attributes.position
    const colors = new Float32Array(positions.count * 3)
    
    const baseColor = new THREE.Color(palette.ground).convertSRGBToLinear()
    const highlightColor = new THREE.Color(palette.patch).convertSRGBToLinear()
    const color = new THREE.Color()

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const y = positions.getY(index)
      const z = getTerrainHeight(x, -y, terrainSettings) || 0
      positions.setZ(index, z)
      
      const heightNorm = Math.max(0, Math.min(1, (z + 1.5) / 4)) || 0
      const n1 = Math.sin(x * 0.12) * Math.cos(y * 0.12) || 0
      const n2 = Math.sin((x + y) * 0.07) || 0
      const noise = (n1 + n2) * 0.3 + 0.6
      
      // Add a +0.25 boost to the mixFactor so it naturally biases toward the lighter highlightColor
      const mixFactor = Math.max(0, Math.min(1, heightNorm * 0.4 + noise * 0.6 + 0.25)) || 0
      color.copy(baseColor).lerp(highlightColor, mixFactor)
      
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.attributes.color.needsUpdate = true
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [terrainSettings, palette])

  useEffect(() => {
    return () => {
      terrainGeometry.dispose()
    }
  }, [terrainGeometry])

  return (
    <group>
      <mesh
        receiveShadow
        rotation-x={-Math.PI / 2}
        position={[0, TERRAIN_Y_OFFSET, 0]}
        geometry={terrainGeometry}
      >
        <meshStandardMaterial vertexColors={true} roughness={1} />
      </mesh>

    </group>
  )
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

function Rocks({ palette, terrainSettings }) {
  return (
    <group>
      {ROCKS.map((rock) => (
        <group
          key={rock.id}
          position={[
            rock.x,
            sampleTerrainMeshHeight(rock.x, rock.z, terrainSettings) +
              TERRAIN_Y_OFFSET,
            rock.z,
          ]}
          rotation={rock.rotation}
          scale={rock.scale}
        >
          <RockModel type={rock.type} palette={palette} />
        </group>
      ))}
    </group>
  )
}

function WildGrass({ palette, terrainSettings }) {
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
        
        // Add distortion to the radius to create irregular, organic field shapes
        const blobDistortion = 1 + Math.sin(bAngle * 3 + pseudoRandom(f) * 10) * 0.4
        const bRad = fieldRadius * Math.sqrt(pseudoRandom(f * 3000 + b * 11)) * blobDistortion

        const x = fx + Math.cos(bAngle) * bRad
        const z = fz + Math.sin(bAngle) * bRad

        if (Math.abs(x) > WORLD_RADIUS + 3 || Math.abs(z) > WORLD_RADIUS + 3) continue;

        const y = sampleTerrainMeshHeight(x, z, terrainSettings) + TERRAIN_Y_OFFSET

        const h = 0.15 + pseudoRandom(f * 4000 + b * 13) * 0.35
        const rx = (pseudoRandom(f * 5000 + b * 17) - 0.5) * 0.7
        const rz = (pseudoRandom(f * 6000 + b * 19) - 0.5) * 0.7
        const ry = pseudoRandom(f * 7000 + b * 23) * Math.PI * 2

        // dummy.position.y is pushed down by 40% of the blade height to strictly avoid floating
        dummy.position.set(x, y + h * 0.1, z)
        dummy.rotation.set(rx, ry, rz)
        dummy.scale.set(0.04 + pseudoRandom(b * 2) * 0.02, h, 0.04 + pseudoRandom(b * 3) * 0.02)
        dummy.updateMatrix()
        
        mats.push(dummy.matrix.clone())
      }
    }
    return mats
  }, [terrainSettings])

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

function EdgeFence({ palette, terrainSettings }) {
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
        const postY =
          sampleTerrainMeshHeight(post.x, post.z, terrainSettings) + TERRAIN_Y_OFFSET
        const railY =
          sampleTerrainMeshHeight(midX, midZ, terrainSettings) + TERRAIN_Y_OFFSET

        return (
          <group key={post.id}>
            <mesh castShadow receiveShadow position={[post.x, postY + 0.75, post.z]}>
              <cylinderGeometry args={[0.15, 0.18, 1.7, 7]} />
              <meshStandardMaterial color="#6f5b43" roughness={0.95} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[midX, railY + 1.05, midZ]}
              rotation={[0, -segmentYaw, 0]}
            >
              <boxGeometry args={[segmentLength * 0.92, 0.12, 0.12]} />
              <meshStandardMaterial color="#725f45" roughness={0.92} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[midX, railY + 0.72, midZ]}
              rotation={[0, -segmentYaw, 0]}
            >
              <boxGeometry args={[segmentLength * 0.92, 0.1, 0.1]} />
              <meshStandardMaterial color="#6b583f" roughness={0.92} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function CameraRig({ cameraRef, controlsRef, focusTarget, palette, isInteractingRef }) {
  const desiredTarget = useRef(new THREE.Vector3(0, 1.6, 0))
  const desiredPosition = useRef(new THREE.Vector3(...palette.cameraPosition))

  useEffect(() => {
    desiredPosition.current.set(...palette.cameraPosition)
    desiredTarget.current.set(0, 1.6, 0)
  }, [palette])

  useEffect(() => {
    if (!focusTarget) {
      desiredPosition.current.set(...palette.cameraPosition)
      desiredTarget.current.set(0, 1.6, 0)
      return
    }

    desiredTarget.current.set(focusTarget.x, 1.8, focusTarget.z)
    desiredPosition.current.set(focusTarget.x + 12, 9, focusTarget.z + 12)
  }, [focusTarget, palette])

  useFrame((_, delta) => {
    if (!cameraRef.current || !focusTarget || isInteractingRef.current) {
      return
    }

    cameraRef.current.position.x = THREE.MathUtils.damp(
      cameraRef.current.position.x,
      desiredPosition.current.x,
      2.3,
      delta,
    )
    cameraRef.current.position.y = THREE.MathUtils.damp(
      cameraRef.current.position.y,
      desiredPosition.current.y,
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

function HabitAreas({
  areas,
  hoveredAreaId,
  onHoverArea,
  onLeaveArea,
  visible,
  onSelectArea,
  terrainSettings,
}) {
  if (!visible) {
    return null
  }

  return (
    <group>
      {areas.map((area) => (
        <group key={area.habitId}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[
              area.centerX,
              sampleTerrainMeshHeight(
                area.centerX,
                area.centerZ,
                terrainSettings,
              ) +
                TERRAIN_Y_OFFSET +
                0.14,
              area.centerZ,
            ]}
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
            <circleGeometry args={[area.radius, 48]} />
            <meshStandardMaterial
              color={area.leafColor}
              transparent
              opacity={hoveredAreaId === area.habitId ? 0.34 : 0.2}
            />
          </mesh>
          <line
            position={[
              area.centerX,
              sampleTerrainMeshHeight(
                area.centerX,
                area.centerZ,
                terrainSettings,
              ) +
                TERRAIN_Y_OFFSET +
                0.18,
              area.centerZ,
            ]}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array(
                    Array.from({ length: 65 }, (_, index) => {
                      const angle = (index / 64) * Math.PI * 2
                      return [
                        Math.cos(angle) * area.radius,
                        0,
                        Math.sin(angle) * area.radius,
                      ]
                    }).flat(),
                  ),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={area.leafColor} />
          </line>
          {hoveredAreaId === area.habitId ? (
            <Html
              position={[
                area.centerX,
                sampleTerrainMeshHeight(
                  area.centerX,
                  area.centerZ,
                  terrainSettings,
                ) +
                  TERRAIN_Y_OFFSET +
                  1.4,
                area.centerZ,
              ]}
              center
            >
              <div className="pointer-events-none rounded-xl border border-white/20 bg-[rgba(12,28,20,0.85)] px-3 py-2 text-xs text-[#eef8ea] shadow-xl">
                <p className="font-semibold">{area.habitName}</p>
                <p className="mt-1">{area.daysCompleted} days completed</p>
                <p>{area.treeCount} trees in this area</p>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
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
}) {
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const isInteractingRef = useRef(false)
  const [hoveredAreaId, setHoveredAreaId] = useState(null)
  const palette = TIME_PRESETS[timeOfDay]
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
      <fog attach="fog" args={[palette.fog, 32, 140]} />

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
      />

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
        rayleigh={1.9}
        turbidity={7}
      />

      <Sparkles
        count={timeOfDay === 'dusk' ? 34 : 18}
        color={palette.sparkle}
        scale={[44, 12, 44]}
        position={[0, 4, 0]}
        size={2.8}
        speed={0.16}
        opacity={0.22}
      />

      <AmbientLife palette={palette} terrainSettings={terrainSettings} allTrees={allTrees} habits={habits} />
      <Ground palette={palette} terrainSettings={terrainSettings} />
      <WildGrass palette={palette} terrainSettings={terrainSettings} />
      <Rocks palette={palette} terrainSettings={terrainSettings} />
      <EdgeFence palette={palette} terrainSettings={terrainSettings} />
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
        onSelectArea={(area) => {
          controlsRef.current?.target.set(area.centerX, 0.8, area.centerZ)
          controlsRef.current?.update()
        }}
      />

      {habits.flatMap((habit) =>
        habit.trees.map((tree) => (
          <Tree
            key={tree.id}
            species={habit.species}
            tree={tree}
            baseY={
              sampleTerrainMeshHeight(tree.x, tree.z, terrainSettings) +
              TERRAIN_Y_OFFSET -
              TREE_GROUND_EMBED
            }
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
                position: { x: tree.x, z: tree.z },
                species: {
                  canopyType: habit.species.canopyType,
                  leafColor: habit.species.leafColor,
                  barkColor: habit.species.barkColor,
                },
              })
            }
          />
        )),
      )}

      <OrbitControls
        ref={controlsRef}
        onStart={() => {
          isInteractingRef.current = true
        }}
        onEnd={() => {
          isInteractingRef.current = false
        }}
        enablePan
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.11}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        panSpeed={0.85}
        maxPolarAngle={Math.PI / 1.98}
        minPolarAngle={Math.PI / 10}
        minDistance={7}
        maxDistance={120}
        screenSpacePanning
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
      />
    </Canvas>
  )
}

export default ForestScene
