import { useState, useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { SHOP_ITEMS } from './ShopModal'
import { ShopItemModel, SHOP_ITEM_3D_CONFIG } from './ShopItemModels'
import { shopThumbnailCache } from '../lib/shopThumbnailCache'

function PreloadStage({ currentItem }) {
  const config = SHOP_ITEM_3D_CONFIG[currentItem.id] || { scale: 1, y: 0, cameraPos: [0, 2, 3.5] }

  return (
    <group position={[0, config.y || 0, 0]} scale={config.scale || 1} rotation={[0, 0.55, 0]}>
      <ShopItemModel type={currentItem.id} />
      {/* Dark pedestal matching shop style */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.1, 16]} />
        <meshStandardMaterial color="#1a2e20" roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}

function PreloadCaptureManager({ onProgress, onComplete }) {
  const { gl, scene, camera } = useThree()
  const [index, setIndex] = useState(0)
  const frameWaitRef = useRef(0)
  const completedRef = useRef(false)

  // Find next un-cached item or current
  const currentItem = SHOP_ITEMS[index] || null

  useEffect(() => {
    if (currentItem) {
      const config = SHOP_ITEM_3D_CONFIG[currentItem.id] || { cameraPos: [0, 2, 3.5], y: 0 }
      const [cx, cy, cz] = config.cameraPos || [0, 2, 3.5]
      camera.position.set(cx, cy, cz)
      camera.lookAt(0, (config.y || 0) + 0.1, 0)
      camera.updateProjectionMatrix()
    }
  }, [currentItem, camera])

  useFrame(() => {
    if (completedRef.current) return

    if (!currentItem) {
      completedRef.current = true
      onProgress?.({
        current: SHOP_ITEMS.length,
        total: SHOP_ITEMS.length,
        percentage: 100,
        itemName: 'All items cached',
      })
      onComplete?.()
      return
    }

    // If item is already cached in memory or session, skip capture immediately
    if (shopThumbnailCache.has(currentItem.id)) {
      const nextIdx = index + 1
      onProgress?.({
        current: nextIdx,
        total: SHOP_ITEMS.length,
        percentage: Math.round((nextIdx / SHOP_ITEMS.length) * 100),
        itemName: currentItem.name,
      })
      setIndex(nextIdx)
      frameWaitRef.current = 0
      return
    }

    // Wait 1 frame so geometry & materials are committed by R3F
    frameWaitRef.current += 1
    if (frameWaitRef.current < 2) return

    try {
      gl.render(scene, camera)
      const dataUrl = gl.domElement.toDataURL('image/png')
      shopThumbnailCache.set(currentItem.id, dataUrl)
    } catch (err) {
      console.warn('Failed to snapshot 3D shop item:', currentItem.id, err)
    }

    const nextIdx = index + 1
    onProgress?.({
      current: nextIdx,
      total: SHOP_ITEMS.length,
      percentage: Math.round((nextIdx / SHOP_ITEMS.length) * 100),
      itemName: currentItem.name,
    })

    frameWaitRef.current = 0
    setIndex(nextIdx)
  })

  if (!currentItem) return null

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} color="#f0fdf4" />
      <directionalLight position={[-5, -2, -5]} intensity={0.6} color="#a8d878" />
      <PreloadStage currentItem={currentItem} />
    </>
  )
}

export default function ShopPreloadRunner({ onProgress, onComplete, isRunning = true }) {
  if (!isRunning) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: 320,
        height: 320,
        opacity: 0.01,
        pointerEvents: 'none',
        zIndex: -9999,
      }}
    >
      <Canvas
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={1.5}
        camera={{ position: [0, 2, 3.5], fov: 45 }}
      >
        <PreloadCaptureManager onProgress={onProgress} onComplete={onComplete} />
      </Canvas>
    </div>
  )
}
