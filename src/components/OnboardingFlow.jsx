import { useCallback, useEffect, useRef, useState } from 'react'

const ONBOARDING_SEEN_KEY = 'forestly_onboarding_seen'
const USER_NAME_KEY = 'forestly_user_name'

export function loadUserName() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(USER_NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function saveUserName(name) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(USER_NAME_KEY, name.trim())
  } catch { /* ignore */ }
}

export function isOnboardingComplete() {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingComplete() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch { /* ignore */ }
}

const SUGGESTED_HABITS = [
  'Drink 8 glasses of water',
  'Read for 20 minutes',
  'Morning stretch',
  'Take a walk',
  'Write in journal',
  'Meditate for 10 minutes',
]

// Easing functions
const easeOutBack = (x) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// ── Step transition wrapper ───────────────────────────────────────────────────
function StepWrapper({ children, isEntering, isExiting, direction = 1 }) {
  const [progress, setProgress] = useState(isEntering ? 0 : 1)

  useEffect(() => {
    if (isEntering) {
      const start = performance.now()
      let raf
      const animate = (now) => {
        const elapsed = now - start
        const p = Math.min(1, elapsed / 400)
        setProgress(easeInOutCubic(p))
        if (p < 1) raf = requestAnimationFrame(animate)
      }
      raf = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(raf)
    }
    if (isExiting) {
      const start = performance.now()
      let raf
      const animate = (now) => {
        const elapsed = now - start
        const p = Math.min(1, elapsed / 300)
        setProgress(1 - easeInOutCubic(p))
        if (p < 1) raf = requestAnimationFrame(animate)
      }
      raf = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(raf)
    }
  }, [isEntering, isExiting])

  const opacity = progress
  const translateX = (1 - progress) * 30 * direction

  return (
    <div
      className="w-full"
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        transition: 'none',
      }}
    >
      {children}
    </div>
  )
}

// ── Animated entrance hook for elements ───────────────────────────────────────
function useAnimatedEntrance(delay = 0) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = performance.now() + delay
    let raf
    const animate = (now) => {
      const elapsed = now - start
      if (elapsed < 0) {
        raf = requestAnimationFrame(animate)
        return
      }
      const p = Math.min(1, elapsed / 500)
      setProgress(easeOutBack(p))
      if (p < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [delay])
  return progress
}

// ── Step 1: Name ──────────────────────────────────────────────────────────────
function StepName({ name, setName, onNext }) {
  const inputRef = useRef(null)
  const iconProg = useAnimatedEntrance(0)
  const titleProg = useAnimatedEntrance(100)
  const descProg = useAnimatedEntrance(200)
  const inputProg = useAnimatedEntrance(300)
  const btnProg = useAnimatedEntrance(400)

  useEffect(() => { inputRef.current?.focus() }, [])

  const canProceed = name.trim().length > 0

  return (
    <div className="flex flex-col items-center text-center">
      <div 
        className="mb-6 text-5xl transition-transform"
        style={{ 
          opacity: iconProg,
          transform: `scale(${0.5 + iconProg * 0.5}) translateY(${(1 - iconProg) * 20}px)`
        }}
      >
        🌲
      </div>
      <h2 
        className="mb-2 text-xl font-bold tracking-tight text-white"
        style={{ 
          opacity: titleProg,
          transform: `translateY(${(1 - titleProg) * 15}px)`
        }}
      >
        Welcome to Forestly
      </h2>
      <p 
        className="mb-8 max-w-xs text-sm leading-relaxed text-[#d4e4cc]/60"
        style={{ 
          opacity: descProg,
          transform: `translateY(${(1 - descProg) * 15}px)`
        }}
      >
        Grow a beautiful forest by building habits. Every check-in plants a tree.
      </p>

      <div 
        className="w-full max-w-xs"
        style={{ 
          opacity: inputProg,
          transform: `translateY(${(1 - inputProg) * 15}px)`
        }}
      >
        <label className="mb-2 block text-left text-[10px] font-semibold uppercase tracking-widest text-[#d4e4cc]/55">
          What should we call you?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canProceed) onNext() }}
          placeholder="Your name"
          className="forest-input w-full rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm text-white placeholder:text-[#d8e7d2]/45"
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canProceed}
        className="mt-6 w-full max-w-xs rounded-2xl bg-[#b8d890] py-3 text-sm font-bold text-[#1e3018] transition hover:bg-[#cdeaa8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        style={{ 
          opacity: btnProg,
          transform: `translateY(${(1 - btnProg) * 15}px) scale(${0.95 + btnProg * 0.05})`
        }}
      >
        Continue
      </button>
    </div>
  )
}

// ── Step 2: Habits ────────────────────────────────────────────────────────────
function StepHabits({ habits, setHabits, onNext, onBack }) {
  const [draft, setDraft] = useState('')
  const [removingIndex, setRemovingIndex] = useState(null)
  const inputRef = useRef(null)
  const iconProg = useAnimatedEntrance(0)
  const titleProg = useAnimatedEntrance(100)
  const descProg = useAnimatedEntrance(200)
  const inputProg = useAnimatedEntrance(300)

  const addHabit = useCallback((habitName) => {
    const trimmed = habitName.trim()
    if (!trimmed || habits.includes(trimmed)) return
    setHabits(prev => [...prev, trimmed])
  }, [habits, setHabits])

  const removeHabit = useCallback((index) => {
    setRemovingIndex(index)
    setTimeout(() => {
      setHabits(prev => prev.filter((_, i) => i !== index))
      setRemovingIndex(null)
    }, 250)
  }, [setHabits])

  const isSuggestedSelected = (s) => habits.includes(s)

  const canProceed = habits.length > 0

  return (
    <div className="flex flex-col items-center text-center">
      <div 
        className="mb-4 text-4xl"
        style={{ 
          opacity: iconProg,
          transform: `scale(${0.5 + iconProg * 0.5})`
        }}
      >
        🌱
      </div>
      <h2 
        className="mb-2 text-xl font-bold tracking-tight text-white"
        style={{ 
          opacity: titleProg,
          transform: `translateY(${(1 - titleProg) * 15}px)`
        }}
      >
        What habits will you grow?
      </h2>
      <p 
        className="mb-6 max-w-xs text-sm leading-relaxed text-[#d4e4cc]/60"
        style={{ 
          opacity: descProg,
          transform: `translateY(${(1 - descProg) * 15}px)`
        }}
      >
        Add a few habits you want to build. You can always add more later.
      </p>

      {/* Add input */}
      <div 
        className="flex w-full max-w-xs gap-2"
        style={{ 
          opacity: inputProg,
          transform: `translateY(${(1 - inputProg) * 15}px)`
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { addHabit(draft); setDraft('') } }}
          placeholder="e.g. Read 20 pages"
          className="forest-input min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/15 px-4 py-2.5 text-sm text-white placeholder:text-[#d8e7d2]/45"
        />
        <button
          type="button"
          onClick={() => { if (draft.trim()) { addHabit(draft); setDraft('') } }}
          disabled={!draft.trim()}
          className="rounded-2xl bg-[#b8d890] px-4 py-2.5 text-sm font-semibold text-[#1e3018] transition hover:bg-[#cdeaa8] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add
        </button>
      </div>

      {/* Suggested chips - always visible, highlight selected */}
      <div className="mt-4 flex w-full max-w-xs flex-wrap justify-center gap-1.5">
        {SUGGESTED_HABITS.map((s, i) => {
          const isSelected = isSuggestedSelected(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => isSelected ? removeHabit(habits.indexOf(s)) : addHabit(s)}
              className={`
                relative overflow-hidden rounded-full border px-3 py-1 text-[10px] transition-all duration-200
                ${isSelected 
                  ? 'border-[#a8d878]/60 bg-[#a8d878]/20 text-[#a8d878] pr-6' 
                  : 'border-white/10 bg-white/5 text-[#dce9d6]/70 hover:border-[#a8d878]/40 hover:text-[#a8d878]'
                }
              `}
              style={{
                animationDelay: `${i * 50}ms`,
              }}
            >
              <span>{s}</span>
              {isSelected && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#a8d878]/30 text-[8px] text-[#a8d878] transition hover:bg-red-500/40 hover:text-red-400">
                  ×
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Added habits list - custom habits only */}
      {habits.length > 0 && (
        <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
          {habits.filter(h => !SUGGESTED_HABITS.includes(h)).map((h, i) => {
            const actualIndex = habits.indexOf(h)
            const isRemoving = removingIndex === actualIndex
            return (
              <div
                key={`${h}-${i}`}
                className={`
                  flex items-center justify-between rounded-xl border border-white/10 bg-black/12 px-3 py-2.5 text-left
                  transition-all duration-250
                `}
                style={{
                  opacity: isRemoving ? 0 : 1,
                  transform: isRemoving ? 'translateX(20px)' : 'translateX(0)',
                }}
              >
                <span className="truncate text-sm text-white">{h}</span>
                <button
                  type="button"
                  onClick={() => removeHabit(actualIndex)}
                  className="ml-2 shrink-0 rounded-full p-1 text-[#d4e4cc]/30 transition hover:bg-red-500/20 hover:text-red-400"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9.5 2.5l-7 7M2.5 2.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex w-full max-w-xs gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 rounded-2xl bg-[#b8d890] py-3 text-sm font-bold text-[#1e3018] transition hover:bg-[#cdeaa8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Grow my forest
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Loading (no progress bar) ──────────────────────────────────────────
function StepLoading({ userName, habits }) {
  const [currentMessage, setCurrentMessage] = useState(0)

  useEffect(() => {
    const messages = [
      { text: 'Preparing the soil...', duration: 800 },
      { text: `Planting seeds for ${habits.length} habits...`, duration: 900 },
      { text: 'Watering your first trees...', duration: 700 },
      { text: 'Letting the sun in...', duration: 800 },
      { text: 'Almost there...', duration: 600 },
      { text: 'Ready to grow!', duration: 400 },
    ]

    let cancelled = false
    let timeouts = []
    let elapsed = 0

    messages.forEach((msg, i) => {
      const timeout = setTimeout(() => {
        if (!cancelled) setCurrentMessage(i)
      }, elapsed)
      timeouts.push(timeout)
      elapsed += msg.duration
    })

    return () => {
      cancelled = true
      timeouts.forEach(t => clearTimeout(t))
    }
  }, [habits.length])

  const messages = [
    'Preparing the soil...',
    `Planting seeds for ${habits.length} habits...`,
    'Watering your first trees...',
    'Letting the sun in...',
    'Almost there...',
    'Ready to grow!',
  ]

  const iconProg = useAnimatedEntrance(0)

  return (
    <div className="flex flex-col items-center text-center">
      <div 
        className="mb-8 text-6xl"
        style={{ 
          opacity: iconProg,
          transform: `scale(${0.5 + iconProg * 0.5})`
        }}
      >
        🌿
      </div>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">
        Welcome, {userName}
      </h2>
      <p className="h-6 text-sm text-[#d4e4cc]/70 transition-all duration-300">
        {messages[currentMessage]}
      </p>
      {/* Animated dots */}
      <div className="mt-6 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-[#a8d878]"
            style={{
              animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              opacity: 0.6 + (currentMessage / 5) * 0.4,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(1); opacity: 0.4; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Live Tooltip Tutorial ───────────────────────────────────────────────────
// Overlays tooltips on actual UI elements of the app
function LiveTooltipTutorial({ onFinish }) {
  const [step, setStep] = useState(0)
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  )

  const tooltips = [
    {
      id: 'habits',
      title: '📝 Track Habits',
      desc: 'Check off your habits here daily. Each completion plants a tree!',
      position: { left: '24rem', top: '8rem' }, // Positioned near habit panel
      arrow: 'left',
    },
    {
      id: 'stats',
      title: '📅 Your Progress',
      desc: 'See the date and how many trees you\'ve grown.',
      position: { left: '50%', top: '6rem', transform: 'translateX(-50%)' },
      arrow: 'top',
    },
    {
      id: 'explore',
      title: '👀 Explore',
      desc: isTouch 
        ? 'Swipe to pan, pinch to zoom. Tap any tree to see its details.'
        : 'Click and drag to look around. Use WASD to move, scroll to zoom.',
      position: { right: '3rem', top: '40%', width: '16rem' },
      arrow: 'right',
    },
    {
      id: 'streaks',
      title: '🔥 Build Streaks',
      desc: 'Keep your streak alive! Missing 2 days will cause your trees to wither.',
      position: { left: '24rem', top: '50%' },
      arrow: 'left',
    },
    {
      id: 'customize',
      title: '🌅 Customize',
      desc: 'Switch to Settings tab to change time of day, terrain, and forest seed.',
      position: { left: '24rem', top: '70%' },
      arrow: 'left',
    },
  ]

  const current = tooltips[step]
  const isLastStep = step === tooltips.length - 1

  const Arrow = ({ direction }) => {
    const styles = {
      left: 'absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-[#1a2e1f] border-r border-b border-[#a8d878]/40',
      right: 'absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-[#1a2e1f] border-l border-t border-[#a8d878]/40',
      top: 'absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-[#1a2e1f] border-r border-b border-[#a8d878]/40',
      bottom: 'absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-[#1a2e1f] border-l border-t border-[#a8d878]/40',
    }
    return <div className={styles[direction]} />
  }

  return (
    <>
      {/* Dimmed overlay - allows seeing the actual UI */}
      <div className="pointer-events-none fixed inset-0 z-[90] bg-black/50 transition-opacity duration-500" />

      {/* Tooltip */}
      <div
        className="fixed z-[101] transition-all duration-500 ease-out"
        style={{
          ...current.position,
        }}
      >
        <div className="forest-panel relative max-w-[16rem] rounded-2xl border border-[#a8d878]/30 bg-[#1a2e1f]/95 p-4 shadow-2xl backdrop-blur-sm">
          <Arrow direction={current.arrow} />
          <h3 className="mb-1 text-sm font-bold text-white">{current.title}</h3>
          <p className="text-[11px] leading-relaxed text-[#d4e4cc]/90">{current.desc}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">
              {tooltips.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-[#a8d878]' : 'w-1.5 bg-white/20'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="rounded-lg border border-white/15 px-3 py-1 text-[10px] text-white transition hover:bg-white/5"
                >
                  Back
                </button>
              )}
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="rounded-lg bg-[#b8d890] px-3 py-1 text-[10px] font-semibold text-[#1e3018] transition hover:bg-[#cdeaa8]"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinish}
                  className="rounded-lg bg-[#b8d890] px-3 py-1 text-[10px] font-semibold text-[#1e3018] transition hover:bg-[#cdeaa8]"
                >
                  Start Growing! 🌱
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main onboarding component ─────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [habits, setHabits] = useState([])
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)

  const handleNext = useCallback(() => {
    if (step === 0) {
      saveUserName(name)
    }
    if (step === 1) {
      // Start loading - wait for natural loading animation (~3.5s)
      setStep(2)
      setTimeout(() => {
        setIsLoadingComplete(true)
        setStep(3)
      }, 3500)
      return
    }
    if (step === 3) {
      markOnboardingComplete()
      onComplete(habits)
      return
    }
    setStep(s => s + 1)
  }, [step, name, habits, onComplete])

  const handleBack = useCallback(() => {
    setStep(s => s - 1)
  }, [])

  const handleFinish = useCallback(() => {
    markOnboardingComplete()
    onComplete(habits)
  }, [habits, onComplete])

  // For steps 0-2: show modal with solid background
  // For step 3: show live tooltips over the actual app
  const showModal = step <= 2

  if (!showModal) {
    // Live tooltip tutorial overlays the actual app
    return <LiveTooltipTutorial onFinish={handleFinish} />
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: '#0d1f14' }}
    >
      <div className="forest-panel relative w-full max-w-md overflow-hidden rounded-[28px] p-6 text-[#edf6ea] md:p-8">
        {/* Step content with transitions */}
        <div className="relative">
          {step === 0 && (
            <StepWrapper isEntering={step === 0} direction={1}>
              <StepName name={name} setName={setName} onNext={handleNext} />
            </StepWrapper>
          )}
          {step === 1 && (
            <StepWrapper isEntering={step === 1} direction={step > 0 ? 1 : -1}>
              <StepHabits habits={habits} setHabits={setHabits} onNext={handleNext} onBack={handleBack} />
            </StepWrapper>
          )}
          {step === 2 && (
            <StepWrapper isEntering={step === 2} direction={1}>
              <StepLoading userName={name} habits={habits} />
            </StepWrapper>
          )}
        </div>
      </div>
    </div>
  )
}
