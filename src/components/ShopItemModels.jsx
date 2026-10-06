import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// --- 3D MODEL COMPONENTS ---

export function StonePath({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  return (
    <group>
      <mesh receiveShadow={!isPreview} position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 6]} />
        <meshStandardMaterial color="#889988" roughness={1.0} transparent={isPreview} opacity={opacity} flatShading />
      </mesh>
    </group>
  )
}

export function LogSeat({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={1.0} transparent={isPreview} opacity={opacity} />
  return (
    <group>
      <mesh castShadow={!isPreview} position={[-0.4, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 6]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0.4, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 6]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.2, 8]} />
        {woodMat}
      </mesh>
    </group>
  )
}

export function FlowerBed({ isPreview = false }) {
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

export function Well({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#888888" roughness={0.9} transparent={isPreview} opacity={opacity} flatShading />
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const roofMat = <meshStandardMaterial color="#354a3c" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const waterMat = <meshStandardMaterial color="#3b82f6" transparent opacity={isPreview ? 0.6 : 0.8} />

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

export function Watchtower({ isPreview = false }) {
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

export function GiantCrystal({ isPreview = false }) {
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

export function MushroomPatch({ isPreview = false }) {
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

export function WoodenFence({ isPreview = false }) {
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

export function Statue({ isPreview = false }) {
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

export function Hammock({ isPreview = false }) {
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

export function Fountain({ isPreview = false }) {
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

export function ToriGate({ isPreview = false }) {
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

export function LanternPost({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const metalMat = <meshStandardMaterial color="#222" roughness={0.6} transparent={isPreview} opacity={opacity} />
  const glassMat = <meshBasicMaterial color="#ffeeb0" transparent={isPreview} opacity={opacity} />

  return (
    <group>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.6, 5]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0.3, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 4]} />
        {woodMat}
      </mesh>
      <mesh position={[0.5, 1.4, 0]}>
        <coneGeometry args={[0.15, 0.15, 4]} />
        {metalMat}
      </mesh>
      <mesh position={[0.5, 1.25, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 4]} />
        {glassMat}
      </mesh>
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

export function Birdhouse({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const poleMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const houseMat = <meshStandardMaterial color="#8e9968" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const roofMat = <meshStandardMaterial color="#c2634e" roughness={0.8} transparent={isPreview} opacity={opacity} />
  const holeMat = <meshBasicMaterial color="#1f1f1f" transparent={isPreview} opacity={opacity} />

  return (
    <group>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 2.0, 5]} />
        {poleMat}
      </mesh>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.2, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {houseMat}
      </mesh>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.5, 0.3, 4]} />
        {roofMat}
      </mesh>
      <mesh position={[0, 2.2, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        {holeMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 2.05, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.15, 4]} />
        {poleMat}
      </mesh>
    </group>
  )
}

export function Gazebo({ isPreview = false }) {
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
      <mesh receiveShadow={!isPreview} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.2, 8]} />
        {floorMat}
      </mesh>
      {pillars}
      <mesh castShadow={!isPreview} position={[0, 3.1, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.2, 8]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 4.1, 0]}>
        <coneGeometry args={[2.4, 2.0, 8]} />
        {roofMat}
      </mesh>
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

export function Windmill({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const stoneMat = <meshStandardMaterial color="#888" roughness={0.9} transparent={isPreview} opacity={opacity} flatShading />
  const woodMat = <meshStandardMaterial color="#4a3b2c" roughness={0.9} transparent={isPreview} opacity={opacity} />
  const sailMat = <meshStandardMaterial color="#e0dfd5" roughness={1.0} transparent={isPreview} opacity={opacity} side={THREE.DoubleSide} />
  const sailsRef = useRef(null)

  useFrame((state, delta) => {
    if (!isPreview && sailsRef.current) {
      sailsRef.current.rotation.z += delta * 0.5
    }
  })

  const sails = []
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    sails.push(
      <group key={i} rotation={[0, 0, angle]}>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.1, 3.6, 0.1]} />
          {woodMat}
        </mesh>
        <mesh position={[0.4, 2.2, 0]} rotation={[0, 0.2, 0]}>
          <planeGeometry args={[0.7, 2.8]} />
          {sailMat}
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 2.5, 0]}>
        <cylinderGeometry args={[1.2, 1.8, 5.0, 8]} />
        {stoneMat}
      </mesh>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 5.8, 0]}>
        <coneGeometry args={[1.4, 1.6, 8]} />
        {woodMat}
      </mesh>
      <mesh position={[0, 0.8, 1.65]}>
        <boxGeometry args={[0.8, 1.6, 0.2]} />
        {woodMat}
      </mesh>
      <group position={[0, 5.0, 1.3]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.6, 8]} />
          {woodMat}
        </mesh>
        <group ref={sailsRef} position={[0, 0, 0.3]}>
          {sails}
        </group>
      </group>
    </group>
  )
}

export function PicnicTable({ isPreview = false }) {
  const opacity = isPreview ? 0.6 : 1
  const woodMat = <meshStandardMaterial color="#6a4b35" roughness={0.9} flatShading transparent={isPreview} opacity={opacity} />

  return (
    <group>
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.6, 0]}>
        <boxGeometry args={[1.6, 0.1, 0.8]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[-0.6, 0.3, 0]}>
        <boxGeometry args={[0.1, 0.6, 1.4]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0.6, 0.3, 0]}>
        <boxGeometry args={[0.1, 0.6, 1.4]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 0.35, 0.6]}>
        <boxGeometry args={[1.6, 0.1, 0.3]} />
        {woodMat}
      </mesh>
      <mesh castShadow={!isPreview} position={[0, 0.35, -0.6]}>
        <boxGeometry args={[1.6, 0.1, 0.3]} />
        {woodMat}
      </mesh>
    </group>
  )
}

function AnimatedCampfire({ isPreview = false, poleMat, fireMat }) {
  const fireRef = useRef(null)
  const lightRef = useRef(null)
  const smokeRef = useRef(null)

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
    if (fireRef.current) {
      fireRef.current.scale.set(
        1 + Math.sin(t * 15) * 0.1,
        1 + Math.sin(t * 20) * 0.15,
        1 + Math.sin(t * 12) * 0.1
      )
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(t * 18) * 0.3 + Math.sin(t * 7) * 0.2
    }
    if (smokeRef.current) {
      smokeRef.current.children.forEach((child, i) => {
        const p = smokeParticles[i]
        child.position.y += p.speed
        child.position.x += Math.sin(t * 2 + p.phase) * 0.003
        const life = 1 - (child.position.y - 0.2) / 1.5
        if (life > 0) {
          child.scale.setScalar(p.scale * life)
        } else {
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
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.05, 0]}>
        <dodecahedronGeometry args={[0.3, 0]} />
        {poleMat}
      </mesh>
      <mesh ref={fireRef} position={[0, 0.2, 0]}>
        <coneGeometry args={[0.2, 0.4, 4]} />
        {fireMat}
      </mesh>
      {!isPreview && (
        <pointLight ref={lightRef} position={[0, 0.5, 0]} color="#ffaa00" intensity={2} distance={8} decay={2} />
      )}
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

function Tent({ position, rotation, color, isPreview = false }) {
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
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 1.8, 3]} />
        {tentMat}
      </mesh>
      <mesh position={[0, 0.35, -0.91]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.02, 3]} />
        {darkMat}
      </mesh>
      <Pole rotZ={Math.PI / 6} z={-0.95} />
      <Pole rotZ={-Math.PI / 6} z={-0.95} />
      <Pole rotZ={Math.PI / 6} z={0.95} />
      <Pole rotZ={-Math.PI / 6} z={0.95} />
      <mesh castShadow={!isPreview} receiveShadow={!isPreview} position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 5]} />
        {poleMat}
      </mesh>
    </group>
  )
}

export function Campsite({ isPreview = false }) {
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

// Master component that renders any item model
export function ShopItemModel({ type, isPreview = false }) {
  const props = { isPreview }
  switch (type) {
    case 'stone_path': return <StonePath {...props} />
    case 'wooden_fence': return <WoodenFence {...props} />
    case 'mushroom_patch': return <MushroomPatch {...props} />
    case 'log_seat': return <LogSeat {...props} />
    case 'flower_bed': return <FlowerBed {...props} />
    case 'lantern_post': return <LanternPost {...props} />
    case 'picnic_table': return <PicnicTable {...props} />
    case 'statue': return <Statue {...props} />
    case 'hammock': return <Hammock {...props} />
    case 'birdhouse': return <Birdhouse {...props} />
    case 'campsite': return <Campsite {...props} />
    case 'well': return <Well {...props} />
    case 'gazebo': return <Gazebo {...props} />
    case 'fountain': return <Fountain {...props} />
    case 'watchtower': return <Watchtower {...props} />
    case 'tori_gate': return <ToriGate {...props} />
    case 'windmill': return <Windmill {...props} />
    case 'crystal': return <GiantCrystal {...props} />
    default: return null
  }
}

// 3D framing parameters for shop preview thumbnails
export const SHOP_ITEM_3D_CONFIG = {
  stone_path:     { scale: 2.2,  y: -0.1, cameraPos: [0, 2.5, 2.5] },
  wooden_fence:   { scale: 1.1,  y: -0.4, cameraPos: [0, 1.8, 3.2] },
  mushroom_patch: { scale: 2.2,  y: -0.2, cameraPos: [0, 1.8, 2.2] },
  log_seat:       { scale: 1.6,  y: -0.2, cameraPos: [0, 1.8, 2.8] },
  flower_bed:     { scale: 1.5,  y: -0.2, cameraPos: [0, 2.0, 2.8] },
  lantern_post:   { scale: 1.1,  y: -0.8, cameraPos: [0, 1.2, 3.2] },
  picnic_table:   { scale: 1.2,  y: -0.3, cameraPos: [0, 2.0, 3.2] },
  statue:         { scale: 1.1,  y: -0.9, cameraPos: [0, 1.4, 3.2] },
  birdhouse:      { scale: 0.85, y: -1.0, cameraPos: [0, 1.2, 3.5] },
  hammock:        { scale: 0.9,  y: -0.5, cameraPos: [0, 1.8, 3.4] },
  campsite:       { scale: 0.65, y: -0.3, cameraPos: [0, 2.5, 4.0] },
  well:           { scale: 0.9,  y: -0.8, cameraPos: [0, 1.8, 3.2] },
  gazebo:         { scale: 0.45, y: -0.9, cameraPos: [0, 2.0, 4.2] },
  fountain:       { scale: 0.75, y: -0.6, cameraPos: [0, 2.2, 3.6] },
  watchtower:     { scale: 0.38, y: -1.0, cameraPos: [0, 2.0, 4.5] },
  tori_gate:      { scale: 0.46, y: -0.8, cameraPos: [0, 1.8, 4.2] },
  windmill:       { scale: 0.35, y: -1.0, cameraPos: [0, 2.0, 4.8] },
  crystal:        { scale: 0.8,  y: -0.8, cameraPos: [0, 1.8, 3.5] },
}
