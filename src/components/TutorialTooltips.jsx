import { useEffect, useRef, useState } from 'react'

export const TUTORIAL_KEY = 'forestly_tutorial_v1'

const TOUCH_CONTROLS = [
  { icon: '👆', action: 'Pan camera',     detail: 'Swipe with one finger' },
  { icon: '✌️', action: 'Orbit / rotate', detail: 'Hold one finger, swipe with another' },
  { icon: '🤏', action: 'Zoom',           detail: 'Pinch two fingers together or apart' },
  { icon: '👇', action: 'Select a tree',  detail: 'Tap any tree to inspect its habit' },
  { icon: '🗺️', action: 'Zoom to grove',  detail: 'Tap a coloured area in Area View' },
]
const DESKTOP_CONTROLS = [
  { icon: '🖱️', action: 'Pan camera',     detail: 'Left-click drag' },
  { icon: '🖱️', action: 'Orbit / rotate', detail: 'Right-click drag' },
  { icon: '🖱️', action: 'Zoom',           detail: 'Scroll wheel' },
  { icon: '⌨️', action: 'Move camera',    detail: 'W A S D  or  Arrow keys' },
  { icon: '⌨️', action: 'Orbit camera',   detail: 'Q  E  /  I  K' },
  { icon: '🖱️', action: 'Select a tree',  detail: 'Click any tree' },
]

// ── Tutorial steps definition ───────────────────────────────────────────────
// placement: 'right' | 'top' | 'bottom' | 'left'
// customContent: optional React node rendered below the body text
const STEPS = [
  {
    target: 'habit-panel',
    title: 'Your Habit Panel',
    body: 'All your habits live here. Use the tabs to switch between your list, stats, settings, and controls.',
    placement: 'right',
    emoji: '🌿',
    rx: 28,
  },
  {
    target: 'habit-add-form',
    title: 'Add a Habit',
    body: 'Click the + button to add a new habit. Every time you check it off, a new tree grows in your forest.',
    placement: 'bottom',
    emoji: '✏️',
    rx: 16,
  },
  {
    target: 'habit-list',
    title: 'Check In Daily',
    body: 'Mark a habit done for today — your tree is planted the moment you complete it.',
    placement: 'right',
    emoji: '✅',
    rx: 16,
  },
  {
    target: 'tab-stats',
    title: 'Track Your Streaks',
    body: 'The Stats tab shows your 30-day completion rates, current streaks, and milestones for every habit.',
    placement: 'bottom',
    emoji: '📊',
    rx: 999,
  },
  {
    target: 'tab-settings',
    title: 'Shape Your World',
    body: 'Adjust terrain elevation, roughness, and seed to generate a completely different landscape.',
    placement: 'bottom',
    emoji: '⚙️',
    rx: 999,
  },
  {
    target: 'view-toggle',
    title: 'Trees vs. Areas',
    body: 'Switch to Area View to see each habit\'s grove highlighted. Click a coloured area to zoom in.',
    placement: 'bottom',
    emoji: '🗺️',
    rx: 999,
  },
  {
    target: 'tab-controls',
    title: 'Camera Controls',
    body: null,
    placement: 'bottom',
    emoji: '🎮',
    rx: 999,
    isControlsStep: true,
  },
]

// ── Controls list rendered inside the tooltip ────────────────────────────────
function ControlsList() {
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const controls = isTouch ? TOUCH_CONTROLS : DESKTOP_CONTROLS
  return (
    <div className="flex flex-col gap-1.5 mt-1 mb-3">
      {controls.map(({ icon, action, detail }) => (
        <div key={action} className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-2.5 py-1.5">
          <span className="shrink-0 text-sm leading-none">{icon}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white leading-tight">{action}</p>
            <p className="text-[10px] text-[#dce9d6]/50 leading-tight mt-0.5">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tooltip card ─────────────────────────────────────────────────────────────
function TooltipCard({ step, stepIndex, total, rect, onNext, onSkip }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(id)
  }, [stepIndex])

  if (!rect) return null

  const GAP    = 14
  const TIP_W  = step.isControlsStep ? 300 : 280
  // Controls step is taller — approximate
  const TIP_H  = step.isControlsStep ? 340 : 188

  let top, left, arrowSide

  if (step.placement === 'right') {
    top  = rect.top + rect.height / 2 - TIP_H / 2
    left = rect.right + GAP
    arrowSide = 'left'
  } else if (step.placement === 'left') {
    top  = rect.top + rect.height / 2 - TIP_H / 2
    left = rect.left - TIP_W - GAP
    arrowSide = 'right'
  } else if (step.placement === 'bottom') {
    top  = rect.bottom + GAP
    left = rect.left + rect.width / 2 - TIP_W / 2
    arrowSide = 'top'
  } else {
    top  = rect.top - TIP_H - GAP
    left = rect.left + rect.width / 2 - TIP_W / 2
    arrowSide = 'bottom'
  }

  // Clamp to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  left = Math.max(12, Math.min(left, vw - TIP_W - 12))
  top  = Math.max(12, Math.min(top,  vh - TIP_H - 12))

  const arrowStyle = {
    position: 'absolute',
    width: 10, height: 10,
    background: 'rgba(18,36,26,0.96)',
    border: '1px solid rgba(255,255,255,0.12)',
    transform: 'rotate(45deg)',
  }
  if (arrowSide === 'left')   Object.assign(arrowStyle, { left: -6,  top: '50%', marginTop: -5, borderRight: 'none', borderTop: 'none' })
  if (arrowSide === 'right')  Object.assign(arrowStyle, { right: -6, top: '50%', marginTop: -5, borderLeft: 'none', borderBottom: 'none' })
  if (arrowSide === 'top')    Object.assign(arrowStyle, { top: -6,   left: TIP_W / 2 - 5, borderRight: 'none', borderBottom: 'none' })
  if (arrowSide === 'bottom') Object.assign(arrowStyle, { bottom: -6,left: TIP_W / 2 - 5, borderLeft: 'none', borderTop: 'none' })

  return (
    <div
      style={{
        position: 'fixed',
        top, left,
        width: TIP_W,
        zIndex: 310,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
        transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'auto',
      }}
    >
      {/* Arrow */}
      <div style={arrowStyle} />

      {/* Card */}
      <div
        style={{
          background: 'linear-gradient(160deg, rgba(18,36,26,0.97), rgba(12,26,18,0.95))',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          padding: '16px 18px 14px',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl leading-none">{step.emoji}</span>
          <p className="text-[13px] font-bold text-white">{step.title}</p>
          <span className="ml-auto text-[10px] font-semibold text-[#a8d878]/60">
            {stepIndex + 1}/{total}
          </span>
        </div>

        {/* Body text OR controls list */}
        {step.isControlsStep ? (
          <ControlsList />
        ) : (
          <p className="text-[11px] leading-[1.65] text-[#d4e4cc]/70 mb-4">
            {step.body}
          </p>
        )}

        {/* Tip for controls step */}
        {step.isControlsStep && (
          <p className="mb-3 text-[10px] leading-relaxed text-[#dce9d6]/50">
            💡 Revisit the <span className="text-[#a8d878] font-semibold">Controls</span> tab anytime for this reference.
          </p>
        )}

        {/* Step dots + nav */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i === stepIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i <= stepIndex ? '#a8d878' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium text-[#d4e4cc]/45 hover:text-[#d4e4cc]/80 transition"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-full bg-[#b8d890] px-3.5 py-1 text-[11px] font-bold text-[#1e3018] hover:bg-[#cdeaa8] transition active:scale-95"
            >
              {stepIndex === total - 1 ? 'Done 🌲' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Spotlight overlay ────────────────────────────────────────────────────────
function Spotlight({ rect, rx = 12 }) {
  if (!rect) return null
  const PAD = 8
  return (
    <svg
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 300, pointerEvents: 'none' }}
    >
      <defs>
        <mask id="tutorial-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - PAD}
            y={rect.top  - PAD}
            width={rect.width  + PAD * 2}
            height={rect.height + PAD * 2}
            rx={rx}
            fill="black"
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(5,14,10,0.62)" mask="url(#tutorial-mask)" />
      <rect
        x={rect.left - PAD}
        y={rect.top  - PAD}
        width={rect.width  + PAD * 2}
        height={rect.height + PAD * 2}
        rx={rx}
        fill="none"
        stroke="#a8d878"
        strokeWidth={2}
        strokeOpacity={0.8}
        style={{ animation: 'tutorialPulse 1.8s ease-in-out infinite' }}
      />
    </svg>
  )
}

// ── Root TutorialTooltips ────────────────────────────────────────────────────
export default function TutorialTooltips({ onDone }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect]           = useState(null)
  const [exiting, setExiting]     = useState(false)
  const rafRef = useRef(null)

  const step = STEPS[stepIndex]

  useEffect(() => {
    function measure() {
      const el = document.querySelector(`[data-tutorial="${step.target}"]`)
      if (el) setRect(el.getBoundingClientRect())
      else    setRect(null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    rafRef.current = setInterval(measure, 400)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      clearInterval(rafRef.current)
    }
  }, [step.target])

  function handleNext() {
    if (stepIndex < STEPS.length - 1) {
      setRect(null)
      setTimeout(() => setStepIndex(i => i + 1), 80)
    } else {
      finish()
    }
  }

  function finish() {
    setExiting(true)
    localStorage.setItem(TUTORIAL_KEY, '1')
    setTimeout(() => onDone(), 450)
  }

  return (
    <>
      <style>{`
        @keyframes tutorialPulse {
          0%,100% { stroke-opacity: 0.7; stroke-width: 1.5px; }
          50%      { stroke-opacity: 1;   stroke-width: 2.5px; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 299,
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.45s ease',
          pointerEvents: exiting ? 'none' : 'auto',
        }}
      >
        <Spotlight rect={rect} rx={step.rx} />
        <TooltipCard
          step={step}
          stepIndex={stepIndex}
          total={STEPS.length}
          rect={rect}
          onNext={handleNext}
          onSkip={finish}
        />
      </div>
    </>
  )
}
