import { useEffect, useRef, useState } from 'react'

export const ONBOARDING_KEY = 'forestly_onboarding_v1'
export const USER_NAME_KEY  = 'forestly_user_name'

// ── Recommended habits ──────────────────────────────────────────────────────
const RECOMMENDED = [
  // Health
  { id: 'r-morning-jog',   emoji: '🏃', label: 'Morning Jog',      category: 'Health' },
  { id: 'r-drink-water',   emoji: '💧', label: 'Drink Water',       category: 'Health' },
  { id: 'r-sleep-8h',      emoji: '😴', label: 'Sleep 8 Hours',     category: 'Health' },
  { id: 'r-stretch',       emoji: '🧘', label: 'Stretch / Yoga',    category: 'Health' },
  { id: 'r-no-junk',       emoji: '🥗', label: 'Eat Clean',         category: 'Health' },
  // Mind
  { id: 'r-meditate',      emoji: '🧠', label: 'Meditate',          category: 'Mind'   },
  { id: 'r-journal',       emoji: '📓', label: 'Write Journal',     category: 'Mind'   },
  { id: 'r-gratitude',     emoji: '🙏', label: 'Gratitude List',    category: 'Mind'   },
  // Learning
  { id: 'r-read',          emoji: '📚', label: 'Read 20 Pages',     category: 'Learn'  },
  { id: 'r-language',      emoji: '🗣️', label: 'Learn a Language',  category: 'Learn'  },
  { id: 'r-code',          emoji: '💻', label: 'Code Daily',        category: 'Learn'  },
  // Lifestyle
  { id: 'r-no-phone',      emoji: '📵', label: 'No Phone Morning',  category: 'Life'   },
  { id: 'r-cold-shower',   emoji: '🚿', label: 'Cold Shower',       category: 'Life'   },
  { id: 'r-tidy',          emoji: '🏠', label: 'Tidy Space',        category: 'Life'   },
]

// ── Loading stages ──────────────────────────────────────────────────────────
const LOADING_STAGES = [
  { label: 'Generating your terrain…',   duration: 900  },
  { label: 'Planting your first trees…', duration: 1000 },
  { label: 'Waking the forest…',         duration: 800  },
  { label: 'Your forest is ready 🌲',    duration: 600  },
]

// ── Animated 3-dot ellipsis ─────────────────────────────────────────────────
function AnimatedDots() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 4), 380)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="inline-flex gap-[5px] items-center ml-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: '#a8d878',
            opacity: frame > i ? 1 : 0.2,
            transition: 'opacity 0.25s ease',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}

// ── Step 1: Name ────────────────────────────────────────────────────────────
function NameStep({ onNext }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onNext(trimmed)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      {/* Floating trees illustration */}
      <div className="mb-8 relative">
        <div className="text-7xl select-none" style={{ filter: 'drop-shadow(0 8px 32px rgba(80,160,80,0.35))' }}>
          🌲
        </div>
        <div
          className="absolute -top-2 -right-6 text-4xl select-none"
          style={{ filter: 'drop-shadow(0 4px 16px rgba(80,160,80,0.25))', opacity: 0.7 }}
        >
          🌿
        </div>
        <div
          className="absolute -bottom-1 -left-7 text-3xl select-none"
          style={{ filter: 'drop-shadow(0 4px 16px rgba(80,160,80,0.25))', opacity: 0.55 }}
        >
          🌱
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
        Welcome to Forestly
      </h1>
      <p className="text-[13px] text-[#d4e4cc]/65 mb-10 max-w-xs leading-relaxed">
        Your habits grow into a living, breathing 3D forest. Every day you check in, a new tree is planted.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
        <label className="text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8d878]/80 mb-0.5">
          What should we call you?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name…"
          maxLength={32}
          className="forest-input w-full rounded-2xl border border-white/15 bg-black/20 px-5 py-3.5 text-base text-white placeholder:text-[#d8e7d2]/35 text-center"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-[#b8d890] py-3.5 text-sm font-bold text-[#1e3018] transition hover:bg-[#cdeaa8] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-1"
        >
          Let's grow →
        </button>
      </form>

      <p className="mt-8 text-[10px] text-[#d4e4cc]/30">
        Your data stays entirely on your device.
      </p>
    </div>
  )
}

// ── Step 2: Habit picker ────────────────────────────────────────────────────
const CATEGORIES = ['Health', 'Mind', 'Learn', 'Life']
const CAT_LABELS  = { Health: '💪 Health', Mind: '🧘 Mind', Learn: '📖 Learn', Life: '🌅 Lifestyle' }

function HabitsStep({ userName, onNext }) {
  const [selected, setSelected] = useState(new Set())
  const [custom, setCustom]     = useState('')
  const inputRef = useRef(null)

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addCustom() {
    const t = custom.trim()
    if (!t) return
    setSelected(s => new Set([...s, `custom:${t}`]))
    setCustom('')
    inputRef.current?.focus()
  }

  function getHabitNames() {
    return [...selected].map(id => {
      if (id.startsWith('custom:')) return id.slice(7)
      return RECOMMENDED.find(r => r.id === id)?.label ?? id
    })
  }

  return (
    <div className="flex flex-col h-full px-5 py-5 text-[#eef8ea]">
      {/* Header */}
      <div className="shrink-0 mb-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#a8d878]/70 mb-1">
          Step 2 of 2
        </p>
        <h2 className="text-xl font-bold text-white leading-tight">
          What will you track, {userName}?
        </h2>
        <p className="mt-1 text-[11px] text-[#d4e4cc]/55">
          Add your own or pick from the suggestions below.
        </p>
      </div>

      {/* Custom habit input — always visible at top */}
      <div className="shrink-0 mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Type your own habit…"
            maxLength={48}
            className="forest-input min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/15 px-4 py-2.5 text-sm text-white placeholder:text-[#d8e7d2]/35"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="rounded-2xl bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {/* Custom habit tags */}
        {[...selected].some(id => id.startsWith('custom:')) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...selected].filter(id => id.startsWith('custom:')).map(id => {
              const label = id.slice(7)
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full border border-[#a8d878]/40 bg-[#1a3320]/60 px-2.5 py-1 text-[11px] font-medium text-[#c8eaac]"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="ml-0.5 text-[#a8d878]/60 hover:text-red-400 transition"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <p className="shrink-0 mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4e4cc]/40">
        — Or pick from suggestions —
      </p>

      {/* Recommended grid — scrollable */}
      <div className="flex-1 overflow-y-auto pr-0.5 -mr-1 min-h-0">
        {CATEGORIES.map(cat => {
          const habits = RECOMMENDED.filter(r => r.category === cat)
          return (
            <div key={cat} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4e4cc]/45">
                {CAT_LABELS[cat]}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {habits.map(h => {
                  const active = selected.has(h.id)
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggle(h.id)}
                      className={[
                        'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] font-medium transition-all duration-150 active:scale-[0.97]',
                        active
                          ? 'border-[#a8d878]/50 bg-[#1a3320]/60 text-[#c8eaac]'
                          : 'border-white/10 bg-black/12 text-[#dce9d6]/75 hover:border-white/20 hover:bg-black/18',
                      ].join(' ')}
                    >
                      <span className="truncate">{h.label}</span>
                      {active && <span className="ml-2 shrink-0 text-[10px] text-[#a8d878]">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {/* Bottom breathing room */}
        <div className="h-2" />
      </div>

      {/* CTA */}
      <div className="shrink-0 mt-3 pt-3 border-t border-white/8">
        {selected.size > 0 && (
          <p className="mb-2 text-center text-[11px] text-[#d4e4cc]/55">
            {selected.size} habit{selected.size > 1 ? 's' : ''} selected — each one gets its own grove 🌳
          </p>
        )}
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onNext(getHabitNames())}
          className="w-full rounded-2xl bg-[#b8d890] py-3.5 text-sm font-bold text-[#1e3018] transition hover:bg-[#cdeaa8] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selected.size === 0 ? 'Select at least one habit' : 'Plant my forest →'}
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Loading ─────────────────────────────────────────────────────────
function LoadingStep({ onDone }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [visible, setVisible]       = useState(true)
  const [exiting, setExiting]       = useState(false)

  useEffect(() => {
    let elapsed = 0
    const timers = []

    LOADING_STAGES.forEach((stage, i) => {
      const t = setTimeout(() => {
        setStageIndex(i)
      }, elapsed)
      timers.push(t)
      elapsed += stage.duration
    })

    // After all stages, fade out and call onDone
    const doneTimer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => {
        setVisible(false)
        onDone()
      }, 600)
    }, elapsed + 200)

    timers.push(doneTimer)
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stage = LOADING_STAGES[stageIndex]
  const isFinal = stageIndex === LOADING_STAGES.length - 1

  if (!visible) return null

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 text-center"
      style={{
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* Animated forest icons */}
      <div className="mb-8 flex items-end justify-center gap-3 select-none">
        {['🌱', '🌿', '🌲', '🌳', '🌲'].map((icon, i) => (
          <span
            key={i}
            className="text-4xl"
            style={{
              opacity: stageIndex >= i - 1 ? 1 : 0.15,
              transform: `scale(${stageIndex >= i ? 1 : 0.65})`,
              transition: `opacity 0.5s ease ${i * 0.07}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
              filter: 'drop-shadow(0 4px 12px rgba(80,160,80,0.3))',
            }}
          >
            {icon}
          </span>
        ))}
      </div>

      {/* Stage label */}
      <p
        key={stageIndex}
        className={`text-[15px] font-semibold mb-4 transition-all duration-300 ${isFinal ? 'text-[#a8d878]' : 'text-white'}`}
        style={{ animation: 'fadeSlideIn 0.35s ease' }}
      >
        {stage.label}
      </p>

      {/* Dot indicators */}
      <div className="flex items-center gap-2.5">
        {LOADING_STAGES.map((_, i) => (
          <div
            key={i}
            style={{
              width: stageIndex === i ? 20 : 8,
              height: 8,
              borderRadius: 999,
              background: i <= stageIndex ? '#a8d878' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        ))}
      </div>
    </div>
  )
}



// ── Root OnboardingFlow ─────────────────────────────────────────────────────
// step: 'name' → 'habits' → 'loading' → null (done)
export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('name')
  const [userName, setUserName] = useState('')
  const [habitNames, setHabitNames] = useState([])
  const [mounted, setMounted] = useState(false)

  // Fade-in on mount
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  function handleNameNext(name) {
    setUserName(name)
    setStep('habits')
  }

  function handleHabitsNext(names) {
    setHabitNames(names)
    setStep('loading')
  }

  function handleLoadingDone() {
    // Persist name + mark onboarding complete
    localStorage.setItem(USER_NAME_KEY, userName)
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completedAt: Date.now() }))
    onComplete({ userName, habitNames })
  }

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.75; }
          40%            { transform: translateY(-9px); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* Full-screen overlay */}
      <div
        className="fixed inset-0 z-[200] flex items-stretch overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, rgba(10,24,16,0.96) 0%, rgba(15,34,22,0.98) 100%)',
          backdropFilter: 'blur(28px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.55s ease',
        }}
      >
        {/* Subtle background decoration */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 20% 10%, rgba(100,180,80,0.07), transparent),
              radial-gradient(ellipse 55% 45% at 80% 90%, rgba(60,140,80,0.06), transparent)
            `,
          }}
        />

        {/* Card container */}
        <div className="relative z-10 m-auto w-full max-w-sm overflow-hidden rounded-[32px] forest-panel flex flex-col"
          style={{ height: 'min(92vh, 660px)', minHeight: 420 }}
        >
          {/* Step indicator dots (top) */}
          {step !== 'loading' && (
            <div className="flex justify-center gap-1.5 pt-5 shrink-0">
              {['name', 'habits'].map((s, i) => (
                <div
                  key={s}
                  style={{
                    width: step === s ? 20 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: ['name', 'habits'].indexOf(step) >= i
                      ? '#a8d878'
                      : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.35s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Step content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {step === 'name'    && <NameStep   onNext={handleNameNext} />}
            {step === 'habits'  && <HabitsStep userName={userName} onNext={handleHabitsNext} />}
            {step === 'loading' && <LoadingStep onDone={handleLoadingDone} />}
          </div>
        </div>
      </div>
    </>
  )
}
