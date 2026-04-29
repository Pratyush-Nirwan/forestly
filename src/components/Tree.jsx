import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function createLeafClusters(species, tree) {
  if (species.canopyType === 'conifer') {
    return [
      { type: 'cone', color: species.leafAccentColor, scale: species.canopyWidth * tree.crownScale * 0.92, position: [0, species.canopyHeight * 0.12, 0] },
      { type: 'cone', color: species.leafColor,       scale: species.canopyWidth * tree.crownScale * 0.74, position: [0, species.canopyHeight * 0.55, 0] },
      { type: 'cone', color: species.leafAccentColor, scale: species.canopyWidth * tree.crownScale * 0.56, position: [0, species.canopyHeight * 0.93, 0] },
    ]
  }

  const clusters = []
  for (let index = 0; index < species.leafDensity; index += 1) {
    const angle = (index / species.leafDensity) * Math.PI * 2 + tree.phase * 0.55 + species.signature * 0.01
    const radius = species.canopyWidth * (0.24 + ((index + 1) % 3) * 0.14) * tree.crownScale
    const heightOffset = species.canopyHeight * (0.16 + (index % 2) * 0.18) * tree.crownScale
    clusters.push({
      type: species.canopyType === 'hybrid' && index % 3 === 0 ? 'cone' : 'orb',
      color: index % 2 === 0 ? species.leafColor : species.leafAccentColor,
      scale: species.leafSize * tree.crownScale * (0.82 + ((index + 1) % 3) * 0.12),
      position: [Math.cos(angle) * radius, heightOffset, Math.sin(angle) * radius],
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

function Tree({ species, tree, onSelect, isSelected, interactive = true, mappedPosition, mappedQuaternion }) {
  const groupRef        = useRef(null)
  const canopyRef       = useRef(null)
  const outlineGroupRef = useRef(null)
  const isHoveredRef    = useRef(false)   // internal — no React state, no re-renders
  const hoverT          = useRef(0)
  const prevSelected    = useRef(isSelected)

  const clusters        = createLeafClusters(species, tree)
  const trunkHeight     = species.trunkHeight * tree.heightScale
  const trunkUnderground = 1.2
  const fullTrunkHeight  = trunkHeight + trunkUnderground
  const baseRadius      = species.trunkThickness * tree.trunkScale
  const topRadius       = baseRadius * 0.72

  // ── Grow-in on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupRef.current) return
    const shouldAnimate = Date.now() - tree.plantedAt < 2800
    groupRef.current.scale.setScalar(shouldAnimate ? 0.001 : tree.scale)
    groupRef.current.position.y = shouldAnimate ? -0.85 : 0
  }, [tree.scale, tree.plantedAt])

  // ── Selection bounce — direct scale impulse, damp in useFrame settles it ───
  useEffect(() => {
    if (isSelected && !prevSelected.current && groupRef.current) {
      // Instantly push the scale up; the damp in useFrame brings it back smoothly
      groupRef.current.scale.setScalar(groupRef.current.scale.x * 1.18)
    }
    prevSelected.current = isSelected
  }, [isSelected])

  useFrame((state, delta) => {
    if (!groupRef.current || !canopyRef.current) return

    // Smooth hover blend — reads internal ref, zero React overhead
    hoverT.current = THREE.MathUtils.damp(hoverT.current, isHoveredRef.current ? 1 : 0, 7, delta)

    // Scale: natural settle back to target (handles both grow-in and bounce decay)
    const targetScale = tree.scale * (1 + hoverT.current * 0.05)
    groupRef.current.scale.setScalar(
      THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 3.5, delta)
    )
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, 0, 4.3, delta)

    // Canopy sway
    const sway = Math.sin(state.clock.elapsedTime * species.swaySpeed + tree.phase) * species.swayAmount
    canopyRef.current.rotation.z = sway
    canopyRef.current.rotation.x = sway * 0.4

    // Outline: persistent when selected, fades in on hover
    if (outlineGroupRef.current) {
      const targetOpacity = isSelected
        ? 0.82 + hoverT.current * 0.12
        : hoverT.current * 0.82
      outlineGroupRef.current.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.opacity = THREE.MathUtils.damp(obj.material.opacity, targetOpacity, 7, delta)
        }
      })
    }
  })

  return (
    <group
      position={mappedPosition}
      quaternion={mappedQuaternion}
      onClick={(e)       => { e.stopPropagation(); onSelect?.(tree) }}
      onPointerOver={(e) => {
        if (!interactive) return
        e.stopPropagation()
        isHoveredRef.current = true
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e)  => {
        if (!interactive) return
        e.stopPropagation()
        isHoveredRef.current = false
        document.body.style.cursor = 'default'
      }}
    >
      <group rotation={[0, tree.rotation, 0]}>
        <group ref={groupRef} rotation={[tree.leanX, 0, tree.leanZ]}>

          {/* ── Trunk ─────────────────────────────────────────────────────── */}
          <mesh castShadow receiveShadow position={[0, (trunkHeight - trunkUnderground) / 2, 0]}>
            <cylinderGeometry args={[topRadius, baseRadius, fullTrunkHeight, 7]} />
            <meshStandardMaterial
              color={species.barkColor}
              flatShading
              roughness={1}
            />
          </mesh>

          {/* ── Canopy ────────────────────────────────────────────────────── */}
          <group
            ref={canopyRef}
            position={[tree.crownOffsetX, trunkHeight * species.crownLift, tree.crownOffsetZ]}
          >
            {clusters.map((cluster, index) => (
              <LeafCluster key={`${tree.id}-cluster-${index}`} {...cluster} />
            ))}
          </group>

          {/* ── Outline shells (BackSide, opacity animated by useFrame) ───── */}
          <group ref={outlineGroupRef}>
            {/* Trunk outline */}
            <mesh position={[0, (trunkHeight - trunkUnderground) / 2, 0]}>
              <cylinderGeometry args={[topRadius * 1.24, baseRadius * 1.24, fullTrunkHeight * 1.05, 7]} />
              <meshStandardMaterial
                color="white" emissive="white" emissiveIntensity={1.0}
                side={THREE.BackSide} transparent opacity={0} depthWrite={false}
              />
            </mesh>

            {/* Canopy outlines */}
            <group position={[tree.crownOffsetX, trunkHeight * species.crownLift, tree.crownOffsetZ]}>
              {clusters.map((cluster, index) =>
                cluster.type === 'cone' ? (
                  <mesh key={`ol-${index}`} position={cluster.position}>
                    <coneGeometry args={[cluster.scale * 0.95 * 1.20, cluster.scale * 1.8 * 1.10, 7]} />
                    <meshStandardMaterial
                      color="white" emissive="white" emissiveIntensity={1.0}
                      side={THREE.BackSide} transparent opacity={0} depthWrite={false}
                    />
                  </mesh>
                ) : (
                  <mesh key={`ol-${index}`} position={cluster.position}>
                    <icosahedronGeometry args={[cluster.scale * 1.20, 0]} />
                    <meshStandardMaterial
                      color="white" emissive="white" emissiveIntensity={1.0}
                      side={THREE.BackSide} transparent opacity={0} depthWrite={false}
                    />
                  </mesh>
                )
              )}
            </group>
          </group>

        </group>
      </group>
    </group>
  )
}

export default Tree
