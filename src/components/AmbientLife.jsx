import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD_RADIUS, WATER_LEVEL, sampleTerrainMeshHeight, mapToWorld, findDryLand } from '../lib/forest'

const TERRAIN_Y_OFFSET = -0.18

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function getRandomForestPos() {
  const angle = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random()) * WORLD_RADIUS
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  }
}

export function FallingLeaves({ palette, terrainSettings, globalSeed, worldShape, count = 100 }) {
  const meshRef = useRef(null)

  const leaves = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const pos = getRandomForestPos()
      return {
        position: new THREE.Vector3(pos.x, 2 + Math.random() * 12, pos.z),
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        speed: 0.8 + Math.random() * 1.5,
        swaySpeed: 1 + Math.random() * 2,
        swayAmount: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        rotSpeed: new THREE.Euler(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        )
      }
    })
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const leaf = leaves[i]

      // Fall down
      leaf.position.y -= leaf.speed * delta

      // Sway horizontally
      leaf.position.x += Math.sin(time * leaf.swaySpeed + leaf.phase) * leaf.swayAmount * delta
      leaf.position.z += Math.cos(time * leaf.swaySpeed * 0.8 + leaf.phase) * leaf.swayAmount * delta

      // Rotate
      leaf.rotation.x += leaf.rotSpeed.x * delta
      leaf.rotation.y += leaf.rotSpeed.y * delta
      leaf.rotation.z += leaf.rotSpeed.z * delta

      // Check ground collision
      const groundY = sampleTerrainMeshHeight(leaf.position.x, leaf.position.z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
      if (leaf.position.y < groundY) {
        const newPos = getRandomForestPos()
        leaf.position.set(newPos.x, 10 + Math.random() * 6, newPos.z)
      }

      const scale = 0.6 + Math.sin(leaf.phase * 10) * 0.2
      
      const mapped = mapToWorld(leaf.position.x, leaf.position.y, leaf.position.z, worldShape)
      dummy.position.set(...mapped.position)
      dummy.quaternion.copy(mapped.quaternion).multiply(new THREE.Quaternion().setFromEuler(leaf.rotation))
      
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
      <planeGeometry args={[0.2, 0.2]} />
      <meshStandardMaterial color={palette.patch} side={THREE.DoubleSide} roughness={0.8} />
    </instancedMesh>
  )
}

export function Butterflies({ palette, terrainSettings, globalSeed, worldShape, count = 30 }) {
  const meshRef = useRef(null)

  const butterflies = useMemo(() => {
    return Array.from({ length: count }, () => {
      const pos = getRandomForestPos()
      const groundY = sampleTerrainMeshHeight(pos.x, pos.z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
      return {
        position: new THREE.Vector3(pos.x, groundY + 0.5 + Math.random() * 2, pos.z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2),
        targetOffset: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        colorIndex: Math.floor(Math.random() * 3)
      }
    })
  }, [count, terrainSettings])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const b = butterflies[i]

      // Update velocity erratically
      b.velocity.x += (Math.random() - 0.5) * 8 * delta
      b.velocity.y += (Math.random() - 0.5) * 4 * delta
      b.velocity.z += (Math.random() - 0.5) * 8 * delta

      // Limit speed
      b.velocity.clampLength(0.5, 3.0)

      b.position.addScaledVector(b.velocity, delta)

      // Keep near ground
      const groundY = sampleTerrainMeshHeight(b.position.x, b.position.z, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
      const targetY = groundY + 1.5 + Math.sin(time * 2 + b.phase) * 1.0

      b.position.y += (targetY - b.position.y) * 2 * delta

      // Keep inside forest
      if (b.position.lengthSq() > WORLD_RADIUS * WORLD_RADIUS) {
        b.velocity.multiplyScalar(-1)
        b.position.addScaledVector(b.velocity, delta * 2)
      }

      // Face velocity roughly
      dummy.position.copy(b.position)
      dummy.lookAt(b.position.x + b.velocity.x, b.position.y, b.position.z + b.velocity.z)
      
      const flap = Math.max(0.1, Math.abs(Math.sin(time * 20 + b.phase)))
      const localQuat = dummy.quaternion.clone()
      
      const mapped = mapToWorld(b.position.x, b.position.y, b.position.z, worldShape)
      dummy.position.set(...mapped.position)
      dummy.quaternion.copy(mapped.quaternion).multiply(localQuat)
      
      dummy.scale.set(flap, 1, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow>
      <planeGeometry args={[0.15, 0.15]} />
      <meshStandardMaterial color="#fff4b3" side={THREE.DoubleSide} emissive="#fff4b3" emissiveIntensity={0.4} />
    </instancedMesh>
  )
}

export function FlockingBirds({ habits, allTrees, terrainSettings, globalSeed, worldShape }) {
  const meshRef = useRef(null)

  const birdGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const vertices = new Float32Array([
      0, 0, 0.4,       // 0: Nose
      0, 0, -0.3,      // 1: Tail
      -0.6, 0.1, -0.1, // 2: Left wing
      0.6, 0.1, -0.1,  // 3: Right wing
      0, -0.1, 0,      // 4: Belly
    ])
    const indices = [
      0, 2, 1, // top left
      0, 1, 3, // top right
      0, 4, 2, // bottom left front
      0, 3, 4, // bottom right front
      1, 2, 4, // bottom left back
      1, 4, 3, // bottom right back
    ]
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [])

  const habitCount = habits.length

  const birds = useMemo(() => {
    const newBirds = []
    habits.forEach((habit) => {
      for (let i = 0; i < 3; i++) {
        let pos
        if (habit.trees.length > 0) {
          const tree = habit.trees[Math.floor(Math.random() * habit.trees.length)]
          // Mirror ForestScene: relocate to dry land if tree's stored position is underwater
          let tx = tree.x
          let tz = tree.z
          const rawY = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
          if (rawY < WATER_LEVEL + 0.3) {
            const dryPos = findDryLand(tx, tz, terrainSettings, globalSeed)
            tx = dryPos.x
            tz = dryPos.z
          }
          const groundY = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
          const height = habit.species.trunkHeight * tree.heightScale + 0.4
          pos = new THREE.Vector3(tx, groundY + height, tz)
        } else {
          const randomPos = getRandomForestPos()
          pos = new THREE.Vector3(randomPos.x, 10, randomPos.z)
        }

        newBirds.push({
          position: pos,
          velocity: new THREE.Vector3(1, 0, 0),
          target: new THREE.Vector3(),
          state: 'PERCHING', // start perched on the tree
          timer: Math.random() * 8, // perch for random time initially
          phase: Math.random() * Math.PI * 2
        })
      }
    })
    return newBirds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitCount, terrainSettings])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    const count = birds.length

    for (let i = 0; i < count; i++) {
      const b = birds[i]

      dummy.scale.set(1, 1, 1)

      if (b.state === 'PERCHING') {
        b.timer -= delta
        if (b.timer <= 0) {
          b.state = 'FLYING'
          // Pick new target
          if (habits && habits.length > 0) {
            const habit = habits[Math.floor(Math.random() * habits.length)]
            if (habit.trees.length > 0) {
              const tree = habit.trees[Math.floor(Math.random() * habit.trees.length)]
              // Mirror ForestScene: relocate to dry land if tree's stored position is underwater
              let tx = tree.x
              let tz = tree.z
              const rawY = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
              if (rawY < WATER_LEVEL + 0.3) {
                const dryPos = findDryLand(tx, tz, terrainSettings, globalSeed)
                tx = dryPos.x
                tz = dryPos.z
              }
              const groundY = sampleTerrainMeshHeight(tx, tz, terrainSettings, globalSeed) + TERRAIN_Y_OFFSET
              const height = habit.species.trunkHeight * tree.heightScale + 0.4
              b.target.set(tx, groundY + height, tz)
            } else {
              const pos = getRandomForestPos()
              b.target.set(pos.x, 8 + Math.random() * 8, pos.z)
            }
          } else {
            const pos = getRandomForestPos()
            b.target.set(pos.x, 8 + Math.random() * 8, pos.z)
          }
          // Take off upwards a bit
          b.velocity.set(Math.random() - 0.5, 1, Math.random() - 0.5).normalize().multiplyScalar(4)
        }

        // Bob slightly while perched
        dummy.position.copy(b.position)
        dummy.position.y += Math.sin(time * 5 + b.phase) * 0.02
        dummy.rotation.set(0, b.phase, 0)
        dummy.scale.set(0.25, 1, 1) // Fold wings while perching

      } else {
        // FLYING
        const dir = new THREE.Vector3().subVectors(b.target, b.position)
        const dist = dir.length()

        if (dist < 1.0) {
          b.state = 'PERCHING'
          b.timer = 3 + Math.random() * 8
          b.velocity.set(0, 0, 0)
          b.position.copy(b.target) // snap to exact tree position
        } else {
          dir.normalize()

          // Steer
          b.velocity.lerp(dir.multiplyScalar(6), delta * 2)

          // Flapping sine wave
          const flapY = Math.sin(time * 12 + b.phase) * 0.05

          b.position.addScaledVector(b.velocity, delta)
          b.position.y += flapY

          dummy.position.copy(b.position)

          // Look along velocity
          const lookTarget = new THREE.Vector3().copy(b.position).add(b.velocity)
          dummy.lookAt(lookTarget)

          // Simulate wings flapping by stretching/squishing the X axis
          const flap = 0.6 + 0.4 * Math.sin(time * 25 + b.phase)
          dummy.scale.set(flap, 1, 1)
        }
      }

      const localQuat = dummy.quaternion.clone()
      const mapped = mapToWorld(dummy.position.x, dummy.position.y, dummy.position.z, worldShape)
      dummy.position.set(...mapped.position)
      dummy.quaternion.copy(mapped.quaternion).multiply(localQuat)

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[birdGeo, null, birds.length]} castShadow>
      <meshStandardMaterial color="#1a1c1a" roughness={0.7} />
    </instancedMesh>
  )
}

export default function AmbientLife({ palette, terrainSettings, globalSeed, allTrees, habits, worldShape }) {
  return (
    <group>
      <FallingLeaves palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} count={120} />
      <Butterflies palette={palette} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} count={40} />
      <FlockingBirds habits={habits} allTrees={allTrees} terrainSettings={terrainSettings} globalSeed={globalSeed} worldShape={worldShape} />
    </group>
  )
}
