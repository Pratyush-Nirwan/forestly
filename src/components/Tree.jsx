import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function createLeafClusters(species, tree) {
  if (species.canopyType === 'conifer') {
    return [
      {
        type: 'cone',
        color: species.leafAccentColor,
        scale: species.canopyWidth * tree.crownScale * 0.92,
        position: [0, species.canopyHeight * 0.12, 0],
      },
      {
        type: 'cone',
        color: species.leafColor,
        scale: species.canopyWidth * tree.crownScale * 0.74,
        position: [0, species.canopyHeight * 0.55, 0],
      },
      {
        type: 'cone',
        color: species.leafAccentColor,
        scale: species.canopyWidth * tree.crownScale * 0.56,
        position: [0, species.canopyHeight * 0.93, 0],
      },
    ]
  }

  const clusters = []

  for (let index = 0; index < species.leafDensity; index += 1) {
    const angle =
      (index / species.leafDensity) * Math.PI * 2 +
      tree.phase * 0.55 +
      species.signature * 0.01
    const radius =
      species.canopyWidth * (0.24 + ((index + 1) % 3) * 0.14) * tree.crownScale
    const heightOffset =
      species.canopyHeight * (0.16 + (index % 2) * 0.18) * tree.crownScale

    clusters.push({
      type: species.canopyType === 'hybrid' && index % 3 === 0 ? 'cone' : 'orb',
      color: index % 2 === 0 ? species.leafColor : species.leafAccentColor,
      scale:
        species.leafSize *
        tree.crownScale *
        (0.82 + ((index + 1) % 3) * 0.12),
      position: [
        Math.cos(angle) * radius,
        heightOffset,
        Math.sin(angle) * radius,
      ],
    })
  }

  clusters.push({
    type: 'orb',
    color: species.leafAccentColor,
    scale: species.leafSize * tree.crownScale * 1.08,
    position: [0, species.canopyHeight * 0.52 * tree.crownScale, 0],
  })

  return clusters
}

function LeafCluster({ type, color, scale, position }) {
  if (type === 'cone') {
    return (
      <mesh castShadow position={position}>
        <coneGeometry args={[scale * 0.95, scale * 1.8, 7]} />
        <meshStandardMaterial color={color} flatShading roughness={0.95} />
      </mesh>
    )
  }

  return (
    <mesh castShadow position={position}>
      <icosahedronGeometry args={[scale, 0]} />
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  )
}

function Tree({ species, tree, onSelect, isSelected, baseY = 0 }) {
  const groupRef = useRef(null)
  const canopyRef = useRef(null)
  const clusters = createLeafClusters(species, tree)
  const trunkHeight = species.trunkHeight * tree.heightScale
  const trunkUnderground = 1.2
  const fullTrunkHeight = trunkHeight + trunkUnderground
  const baseRadius = species.trunkThickness * tree.trunkScale
  const topRadius = baseRadius * 0.72

  useEffect(() => {
    if (!groupRef.current) {
      return
    }

    const shouldAnimate = Date.now() - tree.plantedAt < 2800
    const initialScale = shouldAnimate ? 0.001 : tree.scale
    groupRef.current.scale.setScalar(initialScale)
    groupRef.current.position.y = shouldAnimate ? -0.85 : 0
  }, [tree.scale, tree.plantedAt])

  useFrame((state, delta) => {
    if (!groupRef.current || !canopyRef.current) {
      return
    }

    const nextScale = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      tree.scale,
      4.6,
      delta,
    )

    groupRef.current.scale.setScalar(nextScale)
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      0,
      4.3,
      delta,
    )

    const sway =
      Math.sin(state.clock.elapsedTime * species.swaySpeed + tree.phase) *
      species.swayAmount

    canopyRef.current.rotation.z = sway
    canopyRef.current.rotation.x = sway * 0.4
  })

  return (
    <group
      position={[tree.x, baseY, tree.z]}
      rotation={[0, tree.rotation, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(tree)
      }}
    >
      <group ref={groupRef} rotation={[tree.leanX, 0, tree.leanZ]}>
        <mesh
          castShadow
          receiveShadow
          position={[0, (trunkHeight - trunkUnderground) / 2, 0]}
        >
          <cylinderGeometry args={[topRadius, baseRadius, fullTrunkHeight, 7]} />
          <meshStandardMaterial
            color={species.barkColor}
            flatShading
            roughness={1}
            emissive={isSelected ? species.barkColor : '#000000'}
            emissiveIntensity={isSelected ? 0.16 : 0}
          />
        </mesh>

        <group
          ref={canopyRef}
          position={[
            tree.crownOffsetX,
            trunkHeight * species.crownLift,
            tree.crownOffsetZ,
          ]}
        >
          {clusters.map((cluster, index) => (
            <LeafCluster
              key={`${tree.id}-cluster-${index}`}
              {...cluster}
            />
          ))}
        </group>
      </group>
    </group>
  )
}

export default Tree
