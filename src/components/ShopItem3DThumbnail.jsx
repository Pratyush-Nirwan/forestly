import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ShopItemModel, SHOP_ITEM_3D_CONFIG } from './ShopItemModels'
import { shopThumbnailCache } from '../lib/shopThumbnailCache'

function RotatingStage({ type, autoRotate = true }) {
  const groupRef = useRef(null)
  const config = SHOP_ITEM_3D_CONFIG[type] || { scale: 1, y: 0 }

  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.7
    }
  })

  return (
    <group ref={groupRef} position={[0, config.y || 0, 0]} scale={config.scale || 1}>
      <ShopItemModel type={type} />
      {/* Decorative Pedestal */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.1, 16]} />
        <meshStandardMaterial color="#1a2e20" roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}

export default function ShopItem3DThumbnail({
  type,
  className = "h-44 w-full",
  interactive = false,
  showPedestal = true,
  isLive = false,
  onLiveToggle,
}) {
  const config = SHOP_ITEM_3D_CONFIG[type] || { cameraPos: [0, 2, 3.5] }
  const [cachedUrl, setCachedUrl] = useState(() => shopThumbnailCache.get(type))
  const [isInteractiveLive, setIsInteractiveLive] = useState(isLive)

  // Sync external isLive prop
  useEffect(() => {
    if (isLive !== undefined) {
      setIsInteractiveLive(isLive)
    }
  }, [isLive])

  // If not yet in cache, poll for it while preload finishes
  useEffect(() => {
    if (!cachedUrl) {
      const interval = setInterval(() => {
        const url = shopThumbnailCache.get(type)
        if (url) {
          setCachedUrl(url)
          clearInterval(interval)
        }
      }, 80)
      return () => clearInterval(interval)
    }
  }, [type, cachedUrl])

  // Live interactive WebGL 3D view
  if (isInteractiveLive) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-[#16271c] to-[#0c1610] ${className}`}>
        {/* Subtle radial ambient highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(168,216,120,0.18),transparent_70%)] pointer-events-none" />

        {/* Live badge */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-emerald-950/80 backdrop-blur-md border border-[#a8d878]/40 px-2 py-0.5 text-[9px] font-bold text-[#a8d878] shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a8d878] animate-ping" />
          <span>LIVE 3D</span>
        </div>

        <Canvas
          camera={{ position: config.cameraPos || [0, 2, 3.5], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} color="#f0fdf4" />
          <directionalLight position={[-5, -2, -5]} intensity={0.6} color="#a8d878" />
          <RotatingStage type={type} autoRotate={!interactive} />
          {interactive && (
            <OrbitControls
              enableZoom={true}
              minDistance={1.8}
              maxDistance={7}
              enablePan={false}
              autoRotate
              autoRotateSpeed={1.0}
            />
          )}
        </Canvas>
      </div>
    )
  }

  // Pre-rendered 3D Snapshot View (Instant 0ms load, zero WebGL context overhead)
  return (
    <div
      onClick={(e) => {
        if (interactive) {
          e.stopPropagation()
          setIsInteractiveLive(true)
          onLiveToggle?.(true)
        }
      }}
      className={`group/thumb relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#16271c] to-[#0c1610] cursor-pointer transition-all duration-300 ${className}`}
    >
      {/* Subtle radial ambient highlight behind model */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(168,216,120,0.12),transparent_70%)] pointer-events-none transition-opacity duration-300 group-hover/thumb:opacity-100" />

      {cachedUrl ? (
        <img
          src={cachedUrl}
          alt={type}
          className="relative z-0 h-full w-full object-contain p-2 select-none transition-transform duration-300 ease-out group-hover/thumb:scale-108 group-hover/thumb:-translate-y-1 drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-white/40">
          <div className="w-5 h-5 rounded-full border-2 border-[#a8d878]/30 border-t-[#a8d878] animate-spin" />
          <span className="text-[10px] font-medium tracking-wide">Loading 3D…</span>
        </div>
      )}

      {/* Interactive 3D Spin Hint Button */}
      {interactive && (
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/75 opacity-70 transition-all duration-200 group-hover/thumb:opacity-100 group-hover/thumb:bg-[#a8d878]/25 group-hover/thumb:text-[#a8d878] group-hover/thumb:border-[#a8d878]/40 shadow-sm">
          <svg className="w-3 h-3 transition-transform duration-300 group-hover/thumb:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>Spin 3D</span>
        </div>
      )}
    </div>
  )
}
