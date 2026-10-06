import { useState, useRef, useEffect, useCallback } from 'react'

export default function HoldToDeleteButton({
  onConfirm,
  holdDuration = 2000,
  label = 'Hold to Delete All Progress',
  confirmLabel = 'Progress Deleted! Resetting…',
  className = '',
}) {
  const [progress, setProgress] = useState(0) // 0 to 100
  const [isHolding, setIsHolding] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const startTimeRef = useRef(null)
  const animFrameRef = useRef(null)
  const isHoldingRef = useRef(false)
  const isConfirmedRef = useRef(false)
  const lastHapticRef = useRef(0)

  const stopHolding = useCallback(() => {
    if (isConfirmedRef.current) return
    isHoldingRef.current = false
    setIsHolding(false)
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    startTimeRef.current = null
    setProgress(0)
  }, [])

  const startHolding = useCallback((e) => {
    if (isConfirmedRef.current || isHoldingRef.current) return

    isHoldingRef.current = true
    setIsHolding(true)
    startTimeRef.current = performance.now()
    lastHapticRef.current = performance.now()

    const step = (now) => {
      if (!isHoldingRef.current || isConfirmedRef.current) return

      const elapsed = now - startTimeRef.current
      const pct = Math.min(100, (elapsed / holdDuration) * 100)
      setProgress(pct)

      // Haptic intervals accelerate as progress reaches the end (from 220ms down to 80ms)
      const hapticInterval = Math.max(80, 220 - (pct / 100) * 140)
      if (now - lastHapticRef.current > hapticInterval && pct > 15) {
        lastHapticRef.current = now
        if (navigator.vibrate) {
          try {
            navigator.vibrate(Math.min(25, 8 + Math.round((pct / 100) * 16)))
          } catch {}
        }
      }

      if (pct >= 100) {
        isConfirmedRef.current = true
        setIsConfirmed(true)
        setIsHolding(false)
        isHoldingRef.current = false
        if (navigator.vibrate) {
          try {
            navigator.vibrate([40, 60, 80])
          } catch {}
        }
        onConfirm?.()
      } else {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
  }, [holdDuration, onConfirm])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const remainingSeconds = Math.max(0.1, ((holdDuration * (100 - progress)) / 100 / 1000)).toFixed(1)
  
  // Power factor: ease-in exponential growth for high suspense near completion
  const progressRatio = Math.max(0, Math.min(1, progress / 100))
  // Jitter grows smoothly from 0 up to 1.0 at full bar
  const jitterIntensity = isHolding ? Math.pow(progressRatio, 1.3).toFixed(3) : 0
  // Jitter frequency tightens from 0.15s down to 0.07s
  const jitterSpeed = `${(0.15 - progressRatio * 0.08).toFixed(3)}s`

  // Scale grows gently from 1.000 up to 1.050 as progress climbs
  const currentScale = isConfirmed
    ? 1
    : isHolding
      ? (1.00 + progressRatio * 0.05).toFixed(3)
      : 1

  return (
    <div
      className={`relative select-none ${isHolding && progressRatio > 0.04 ? 'animate-vibrate' : ''} ${className}`}
      style={{
        '--jitter': jitterIntensity,
        '--jitter-speed': jitterSpeed,
      }}
    >
      <button
        type="button"
        onMouseDown={startHolding}
        onMouseUp={stopHolding}
        onMouseLeave={stopHolding}
        onTouchStart={startHolding}
        onTouchEnd={stopHolding}
        onTouchCancel={stopHolding}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            if (!isHoldingRef.current) startHolding(e)
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            stopHolding()
          }
        }}
        disabled={isConfirmed}
        aria-label={label}
        className={`group relative flex w-full items-center justify-center overflow-hidden rounded-xl border py-3 px-4 text-xs font-bold transition-colors duration-200 outline-none ${
          isConfirmed
            ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-600/40'
            : isHolding
              ? 'border-red-400 bg-red-950/70 text-white ring-2 ring-red-500/60 shadow-lg shadow-red-600/25'
              : 'border-red-500/35 bg-red-950/30 text-red-300 hover:border-red-500/60 hover:bg-red-950/50 hover:text-red-200'
        }`}
        style={{
          transform: `scale(${currentScale})`,
          transition: isHolding ? 'transform 50ms linear' : 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'none',
        }}
      >
        {/* Animated fill background that grows while holding */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 transition-none"
          style={{
            width: `${progress}%`,
            opacity: isConfirmed ? 1 : isHolding ? 0.95 : 0,
            boxShadow: isHolding ? `0 0 ${Math.round(10 + progressRatio * 18)}px rgba(239, 68, 68, ${0.4 + progressRatio * 0.5})` : 'none',
          }}
        />

        {/* Shimmer pulse effect when holding */}
        {isHolding && (
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)] animate-pulse" />
        )}

        {/* Button Content */}
        <div className="relative z-10 flex items-center gap-2 pointer-events-none">
          {isConfirmed ? (
            <>
              <span className="text-sm">✓</span>
              <span>{confirmLabel}</span>
            </>
          ) : isHolding ? (
            <>
              <span className="text-sm animate-bounce">⚠️</span>
              <span>Keep holding… ({remainingSeconds}s)</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 text-red-400 transition-transform duration-200 group-hover:scale-110"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span>{label}</span>
            </>
          )}
        </div>
      </button>
    </div>
  )
}
