import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ShopPreloadRunner from './ShopPreloadRunner'
import { SHOP_ITEMS } from './ShopModal'
import { shopThumbnailCache } from '../lib/shopThumbnailCache'

const STAGES = [
  { threshold: 0,  label: 'Initializing 3D Forest engine…' },
  { threshold: 25, label: 'Sculpting island terrain & ocean…' },
  { threshold: 50, label: 'Preloading 3D shop items…' },
  { threshold: 85, label: 'Waking the flora & sunlight…' },
  { threshold: 98, label: 'Your forest is ready 🌲' },
]

export default function StartLoader({ onDone, fullScreen = true }) {
  const [progress, setProgress] = useState(0)
  const [customStatus, setCustomStatus] = useState(null)
  const [exiting, setExiting] = useState(false)
  const hasFinishedRef = useRef(false)

  // Determine if all items were already cached
  const allAlreadyCached = useMemo(
    () => shopThumbnailCache.isComplete(SHOP_ITEMS.map(i => i.id)),
    []
  )

  // Pure derived state during render (no cascading setState in effects)
  const activeIconIdx = Math.min(4, Math.floor((progress / 100) * 5))

  const stageLabel = useMemo(() => {
    if (customStatus) return customStatus
    let match = STAGES[0].label
    for (const stage of STAGES) {
      if (progress >= stage.threshold) {
        match = stage.label
      }
    }
    return match
  }, [progress, customStatus])

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current) return
    hasFinishedRef.current = true

    setTimeout(() => {
      setExiting(true)
      setTimeout(() => {
        onDone?.()
      }, 500)
    }, 350)
  }, [onDone])

  // Progress smoothing & fallback timer
  useEffect(() => {
    let timer
    if (allAlreadyCached) {
      // Smooth simulated advance over 750ms so user gets a polished visual transition
      let p = 0
      timer = setInterval(() => {
        p += 5
        setProgress(Math.min(100, p))
        if (p >= 100) {
          clearInterval(timer)
          handleFinish()
        }
      }, 35)
    } else {
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev < 45) return prev + 2
          return prev
        })
      }, 50)
    }
    return () => clearInterval(timer)
  }, [allAlreadyCached, handleFinish])

  const handlePreloadProgress = useCallback(({ current, total, itemName }) => {
    if (hasFinishedRef.current) return
    const mapped = 35 + Math.round((current / total) * 60)
    setProgress(prev => Math.max(prev, Math.min(95, mapped)))
    if (itemName && itemName !== 'All items cached') {
      setCustomStatus(`Preloading 3D item: ${itemName} (${current}/${total})`)
    }
  }, [])

  const handlePreloadComplete = useCallback(() => {
    if (hasFinishedRef.current) return
    setProgress(100)
    setCustomStatus('Your forest is ready 🌲')
    handleFinish()
  }, [handleFinish])

  const icons = ['🌱', '🌿', '🌲', '🌳', '🌲']

  return (
    <>
      {/* Background Preloader for 3D Shop Items */}
      <ShopPreloadRunner
        onProgress={handlePreloadProgress}
        onComplete={handlePreloadComplete}
      />

      <div
        className={`${
          fullScreen ? 'fixed inset-0 z-[250]' : 'relative w-full h-full'
        } flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden transition-opacity duration-500`}
        style={{
          background: 'linear-gradient(155deg, #09170f 0%, #0d2618 50%, #08150e 100%)',
          backdropFilter: 'blur(30px)',
          opacity: exiting ? 0 : 1,
          pointerEvents: exiting ? 'none' : 'auto',
        }}
      >
        {/* Soft radial glow in background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 40%, rgba(168,216,120,0.12) 0%, transparent 60%),
              radial-gradient(circle at 20% 80%, rgba(76,175,80,0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Central Card / Visual */}
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full mx-auto">
          {/* Animated Forest Icons */}
          <div className="mb-8 flex items-end justify-center gap-3">
            {icons.map((icon, i) => {
              const isActive = activeIconIdx === i
              const isPassed = activeIconIdx >= i
              return (
                <div
                  key={i}
                  className="transition-all duration-300"
                  style={{
                    transform: isActive ? 'scale(1.28) translateY(-4px)' : isPassed ? 'scale(1)' : 'scale(0.8)',
                    opacity: isPassed ? 1 : 0.25,
                    filter: isActive
                      ? 'drop-shadow(0 6px 16px rgba(168,216,120,0.5))'
                      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
                  }}
                >
                  <span className="text-4xl">{icon}</span>
                </div>
              )
            })}
          </div>

          {/* Title */}
          <h2 className="text-xl font-black tracking-tight text-[#f4fbf0] mb-1">
            Forestly
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a8d878]/70 mb-6">
            Habit Forest Island
          </p>

          {/* Progress Bar Container */}
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner mb-3">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #74c452 0%, #a8d878 50%, #d4f89d 100%)',
                boxShadow: '0 0 12px rgba(168, 216, 120, 0.65)',
              }}
            />
          </div>

          {/* Status Text & Percentage */}
          <div className="w-full flex items-center justify-between text-xs px-1 text-[#d8ebd2]">
            <span className="font-medium truncate max-w-[240px] text-left">
              {stageLabel}
            </span>
            <span className="font-extrabold text-[#a8d878] shrink-0 tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Dot Indicators */}
          <div className="flex items-center gap-1.5 mt-6">
            {[0, 1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: activeIconIdx === idx ? 18 : 6,
                  height: 6,
                  backgroundColor: activeIconIdx >= idx ? '#a8d878' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
