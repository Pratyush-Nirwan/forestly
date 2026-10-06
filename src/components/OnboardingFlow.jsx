import { useEffect, useRef, useState } from 'react'
import StartLoader from './StartLoader'

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
    <div className="flex flex-col items-center justify-center text-center w-full max-w-lg mx-auto py-4">
      {/* Floating trees illustration with ambient aura */}
      <div className="mb-6 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-[#a8d878]/15 blur-3xl rounded-full scale-150 pointer-events-none" />
        <div className="relative flex items-end gap-3 select-none">
          <span className="text-4xl animate-bounce" style={{ animationDuration: '3.5s' }}>🌱</span>
          <span className="text-7xl drop-shadow-[0_12px_28px_rgba(80,180,80,0.45)]">🌲</span>
          <span className="text-4xl opacity-80 animate-pulse" style={{ animationDuration: '3s' }}>🌿</span>
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
        Welcome to Forestly
      </h1>
      <p className="text-sm sm:text-base text-[#d4e4cc]/70 mb-8 max-w-md leading-relaxed px-4">
        Your habits grow into a living, breathing 3D forest island. Every day you check in, a new tree is planted.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3.5 px-4">
        <label className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#a8d878]">
          What should we call you?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name…"
          maxLength={32}
          className="w-full rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 focus:bg-black/40 focus:border-[#a8d878] px-5 py-4 text-lg text-white placeholder:text-white/35 text-center transition-all outline-none shadow-lg backdrop-blur-md"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-[#a8d878] py-4 text-base font-bold text-[#0e1d12] transition-all hover:bg-[#bcf08b] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#a8d878]/25"
        >
          Let's grow →
        </button>
      </form>

      <p className="mt-8 text-xs text-[#d4e4cc]/40">
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
    <div className="flex flex-col w-full max-w-xl mx-auto text-[#eef8ea] text-center px-4">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a8d878] mb-1.5">
          Step 2 of 2
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
          What will you track, {userName}?
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-[#d4e4cc]/65">
          Choose from suggestions or write your own habits to plant your first grove.
        </p>
      </div>

      {/* Custom habit input */}
      <div className="mb-6 w-full max-w-md mx-auto">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Type your own habit…"
            maxLength={48}
            className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 focus:bg-black/40 focus:border-[#a8d878] px-4 py-3 text-sm text-white placeholder:text-white/35 transition-all outline-none"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Custom habit tags */}
        {[...selected].some(id => id.startsWith('custom:')) && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[...selected].filter(id => id.startsWith('custom:')).map(id => {
              const label = id.slice(7)
              return (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-full border border-[#a8d878]/50 bg-[#a8d878]/20 px-3 py-1.5 text-xs font-medium text-[#e8f7dc] shadow-sm"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="ml-1 text-[#a8d878]/70 hover:text-red-400 transition"
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
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[#d4e4cc]/45">
        — Or pick from popular habits —
      </p>

      {/* Recommended grid */}
      <div className="space-y-4 max-h-[46vh] overflow-y-auto custom-scrollbar px-1 mb-6 text-left">
        {CATEGORIES.map(cat => {
          const habits = RECOMMENDED.filter(r => r.category === cat)
          return (
            <div key={cat} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a8d878]/80">
                {CAT_LABELS[cat]}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {habits.map(h => {
                  const active = selected.has(h.id)
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggle(h.id)}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                        active
                          ? 'border-[#a8d878] bg-[#a8d878]/25 text-[#f0fbf0] shadow-md shadow-[#a8d878]/15 font-semibold'
                          : 'border-white/10 bg-white/5 text-[#dce9d6]/80 hover:border-white/25 hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate">{h.label}</span>
                      {active ? (
                        <span className="ml-1.5 shrink-0 text-xs text-[#a8d878] font-bold">✓</span>
                      ) : (
                        <span className="ml-1.5 shrink-0 text-xs opacity-40">{h.emoji}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA Bottom */}
      <div className="w-full max-w-sm mx-auto pt-2">
        {selected.size > 0 && (
          <p className="mb-2.5 text-xs text-[#d4e4cc]/70">
            {selected.size} habit{selected.size > 1 ? 's' : ''} selected — each will grow its own trees 🌳
          </p>
        )}
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onNext(getHabitNames())}
          className="w-full rounded-2xl bg-[#a8d878] py-4 text-sm font-bold text-[#0e1d12] transition-all hover:bg-[#bcf08b] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#a8d878]/20"
        >
          {selected.size === 0 ? 'Select at least one habit' : 'Plant my forest →'}
        </button>
      </div>
    </div>
  )
}

// ── Root OnboardingFlow (Unboxed, Full-Screen) ──────────────────────────────
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
    localStorage.setItem(USER_NAME_KEY, userName)
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completedAt: Date.now() }))
    onComplete({ userName, habitNames })
  }

  // When step is 'loading', render StartLoader directly in fullScreen mode
  if (step === 'loading') {
    return <StartLoader onDone={handleLoadingDone} fullScreen={true} />
  }

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* Full-screen open layout (no card box container) */}
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto px-4 py-8"
        style={{
          background: 'linear-gradient(155deg, rgba(8,20,13,0.97) 0%, rgba(14,35,23,0.98) 100%)',
          backdropFilter: 'blur(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.55s ease',
        }}
      >
        {/* Subtle background ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 60% at 50% 25%, rgba(100,180,80,0.14), transparent),
              radial-gradient(ellipse 60% 50% at 80% 85%, rgba(60,140,80,0.08), transparent)
            `,
          }}
        />

        {/* Content container - unboxed, fluid */}
        <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center my-auto">
          {/* Step indicator dots */}
          <div className="flex justify-center gap-2 mb-8">
            {['name', 'habits'].map((s, i) => (
              <div
                key={s}
                style={{
                  width: step === s ? 24 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: ['name', 'habits'].indexOf(step) >= i
                    ? '#a8d878'
                    : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.35s ease',
                }}
              />
            ))}
          </div>

          {/* Active step */}
          <div className="w-full" style={{ animation: 'fadeSlideIn 0.4s ease' }}>
            {step === 'name'   && <NameStep   onNext={handleNameNext} />}
            {step === 'habits' && <HabitsStep userName={userName} onNext={handleHabitsNext} />}
          </div>
        </div>
      </div>
    </>
  )
}
