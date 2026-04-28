import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import Tree from './Tree'
import {
  getCompletionCalendar,
  getHabitCompletionRate,
  getHabitStreak,
  getLongestStreak,
  getMilestone,
  isHabitWithered,
} from '../lib/forest'


const TERRAIN_SLIDERS = [
  { id: 'amplitude', label: 'Elevation', min: 0.2, max: 1.4, step: 0.05 },
  { id: 'lowFrequency', label: 'Hill Size', min: 0.5, max: 1.8, step: 0.05 },
  { id: 'detailFrequency', label: 'Roughness', min: 0.5, max: 2.1, step: 0.05 },
  { id: 'edgeSoftness', label: 'Edge Smoothing', min: 0.3, max: 2.0, step: 0.05 },
]

// ── Sun-on-arc time-of-day slider ──────────────────────────────────────────────
const ARC_CX = 100
const ARC_CY = 100
const ARC_R = 82

const ARC_PRESETS = [
  { id: 'dawn', label: 'Dawn', angle: 180, sunColor: '#ff9040', rayColor: '#ffb060' },
  { id: 'day', label: 'Day', angle: 90, sunColor: '#ffe566', rayColor: '#fff0a0' },
  { id: 'dusk', label: 'Dusk', angle: 0, sunColor: '#ff6035', rayColor: '#ff9060' },
]

// Colour lerp helper for the SVG sun (separate from Three.js lerpHex)
function lerp3(a, b, t) {
  const h2r = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const ra = h2r(a), rb = h2r(b)
  return '#' + ra.map((v, i) => Math.round(v + (rb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
function arcColorAt(t) {
  // t: 0=dawn, 0.5=day, 1=dusk – interpolate sun colour
  if (t <= 0.5) {
    const lt = t * 2
    return {
      sun: lerp3(ARC_PRESETS[0].sunColor, ARC_PRESETS[1].sunColor, lt),
      ray: lerp3(ARC_PRESETS[0].rayColor, ARC_PRESETS[1].rayColor, lt),
    }
  }
  const lt = (t - 0.5) * 2
  return {
    sun: lerp3(ARC_PRESETS[1].sunColor, ARC_PRESETS[2].sunColor, lt),
    ray: lerp3(ARC_PRESETS[1].rayColor, ARC_PRESETS[2].rayColor, lt),
  }
}

function arcPos(deg) {
  const r = (deg * Math.PI) / 180
  return { x: ARC_CX + ARC_R * Math.cos(r), y: ARC_CY - ARC_R * Math.sin(r) }
}

function SunArcSlider({ timeOfDay, onSetTimeOfDay }) {
  const svgRef = useRef(null)
  const dragging = useRef(false)

  // timeOfDay is now a 0-1 number; convert to angle for display
  const displayAngle = (1 - timeOfDay) * 180
  const sunPos = arcPos(displayAngle)
  const { sun: sunColor, ray: rayColor } = arcColorAt(timeOfDay)

  const getAngleAndT = useCallback((e) => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    const svgX = ((cx - rect.left) / rect.width) * 200
    const svgY = ((cy - rect.top) / rect.height) * 120
    const deg = Math.atan2(ARC_CY - svgY, svgX - ARC_CX) * (180 / Math.PI)
    const angle = Math.max(0, Math.min(180, deg))
    return { angle, t: 1 - angle / 180 }
  }, [])

  const onMove = useCallback((e) => {
    if (!dragging.current) return
    const result = getAngleAndT(e)
    if (result) onSetTimeOfDay(Math.max(0, Math.min(1, result.t)))
  }, [getAngleAndT, onSetTimeOfDay])

  const onUp = useCallback((e) => {
    if (!dragging.current) return
    dragging.current = false
    const result = getAngleAndT(e)
    if (result) onSetTimeOfDay(Math.max(0, Math.min(1, result.t)))
  }, [getAngleAndT, onSetTimeOfDay])

  useEffect(() => {
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [onMove, onUp])

  // Find nearest preset for label highlight
  const nearest = ARC_PRESETS.reduce((b, p) =>
    Math.abs(p.angle - displayAngle) < Math.abs(b.angle - displayAngle) ? p : b
  )

  const labelProps = {
    dawn: { x: arcPos(180).x + 2, y: arcPos(180).y + 14 },
    day: { x: arcPos(90).x, y: arcPos(90).y - 10 },
    dusk: { x: arcPos(0).x - 2, y: arcPos(0).y + 14 },
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#d4e4cc]/60">
        Time of Day
      </p>
      <svg
        ref={svgRef}
        viewBox="0 0 200 120"
        className="w-full cursor-grab active:cursor-grabbing select-none"
        onMouseDown={e => { e.preventDefault(); dragging.current = true }}
        onTouchStart={() => { dragging.current = true }}
      >
        <defs>
          <linearGradient id="sun-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff9040" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#ffe566" stopOpacity="0.70" />
            <stop offset="100%" stopColor="#ff6035" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="sky-glow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#ffe080" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffe080" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="200" height="120" fill="url(#sky-glow)" rx="8" />

        {/* Arc track */}
        <path
          d={`M ${ARC_CX - ARC_R} ${ARC_CY} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`}
          fill="none" stroke="url(#sun-arc-grad)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"
        />

        {/* Tick dots and labels */}
        {ARC_PRESETS.map(p => {
          const pos = arcPos(p.angle)
          const lp = labelProps[p.id]
          const isNearest = p.id === nearest.id
          return (
            <g key={p.id}>
              <circle cx={pos.x} cy={pos.y} r={isNearest ? 3.5 : 2} fill="white" opacity={isNearest ? 0.55 : 0.22} />
              <text x={lp.x} y={lp.y} textAnchor="middle" fontSize="8.5" fill="white"
                opacity={isNearest ? 0.9 : 0.35} fontFamily="system-ui, sans-serif">
                {p.label}
              </text>
            </g>
          )
        })}

        {/* Sun glow */}
        <circle cx={sunPos.x} cy={sunPos.y} r={22} fill={sunColor} opacity={0.06} />
        <circle cx={sunPos.x} cy={sunPos.y} r={14} fill={sunColor} opacity={0.14} />
        <circle cx={sunPos.x} cy={sunPos.y} r={9} fill={sunColor} opacity={0.24} />

        {/* Rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const r2 = (deg * Math.PI) / 180
          return (
            <line key={deg}
              x1={sunPos.x + Math.cos(r2) * 10} y1={sunPos.y + Math.sin(r2) * 10}
              x2={sunPos.x + Math.cos(r2) * 14} y2={sunPos.y + Math.sin(r2) * 14}
              stroke={rayColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8"
            />
          )
        })}

        {/* Sun core + specular */}
        <circle cx={sunPos.x} cy={sunPos.y} r={7} fill={sunColor} />
        <circle cx={sunPos.x - 1.8} cy={sunPos.y - 1.8} r={2.2} fill="white" opacity={0.38} />
      </svg>
    </div>
  )
}


const PREVIEW_TREE = {
  id: 'preview', x: 0, z: 0,
  scale: 1, heightScale: 1, trunkScale: 1, crownScale: 1,
  rotation: 0, crownOffsetX: 0, crownOffsetZ: 0,
  leanX: 0, leanZ: 0, phase: Math.PI / 3, accentMix: 0.5,
  plantedAt: Date.now() - 30000, // pre-grown, no animation
}

function SpinGroup({ children, yOffset }) {
  const ref = useRef(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.55 })
  return <group ref={ref} position={[0, yOffset, 0]}>{children}</group>
}

function TreePreview({ species }) {
  // Approximate tree visual midpoint so it stays centred in the thumbnail
  // regardless of species height variety (trunk 1.7–3.8, canopy 1.7–2.9)
  const approxTop = species.trunkHeight * species.crownLift + species.canopyHeight
  const approxBase = -1.2  // trunkUnderground constant in Tree.jsx
  const yOffset = -((approxTop + approxBase) / 2)

  return (
    <div className="shrink-0 rounded-xl overflow-hidden" style={{ width: 80, height: 112 }}>
      <Canvas
        camera={{ position: [2.5, 0, 9.5], fov: 54, near: 0.3, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <SpinGroup yOffset={yOffset}>
          <Tree
            species={species}
            tree={PREVIEW_TREE}
            mappedPosition={[0, 0, 0]}
            mappedQuaternion={[0, 0, 0, 1]}
            isSelected={false}
          />
        </SpinGroup>
      </Canvas>
    </div>
  )
}


// ── 28-day dot calendar ───────────────────────────────────────────────────────
function CalendarDots({ habit }) {
  const days = useMemo(() => getCompletionCalendar(habit, 28), [habit])
  const weeks = useMemo(
    () => Array.from({ length: 4 }, (_, w) => days.slice(w * 7, w * 7 + 7)),
    [days],
  )
  return (
    <div className="mt-2 flex flex-col gap-[3px]">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-[3px]">
          {week.map((day, di) => (
            <div
              key={di}
              title={new Date(day.ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              className={`h-[7px] w-[7px] rounded-[2px] transition-colors ${day.completed ? 'bg-[#a8d878]' : 'bg-white/10'
                }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Single habit card ─────────────────────────────────────────────────────────
function HabitCard({ habit, completedToday, isPending, onComplete, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const streak = useMemo(() => getHabitStreak(habit), [habit])
  const longest = useMemo(() => getLongestStreak(habit), [habit])
  const milestone = useMemo(() => getMilestone(habit.trees.length), [habit])
  const withered = useMemo(() => isHabitWithered(habit), [habit])

  return (
    <div
      className={`rounded-[20px] border px-4 py-3.5 transition-all ${withered
        ? 'border-amber-400/45 bg-amber-950/25'
        : completedToday
          ? 'border-[#a8d878]/30 bg-[#1a3320]/40'
          : 'border-white/10 bg-black/12 hover:border-white/20 hover:bg-black/18'
        }`}
    >
      {/* Row 1: checkbox + name + badges + delete */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={completedToday}
          disabled={completedToday || isPending}
          onChange={() => onComplete(habit.id)}
          className="mt-[3px] h-4 w-4 shrink-0 cursor-pointer accent-[#a8d878]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm font-semibold ${completedToday ? 'text-[#c8eaac]' : 'text-white'}`}>
              {habit.name}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Streak */}
              {streak > 0 && (
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                  🔥 {streak}d
                </span>
              )}
              {/* Milestone */}
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${milestone.level >= 4 ? 'border-yellow-400/40 text-yellow-300' :
                milestone.level >= 3 ? 'border-emerald-400/35 text-emerald-300' :
                  milestone.level >= 2 ? 'border-green-400/30 text-green-300' :
                    'border-white/15 text-[#d4e4cc]/75'
                }`}>
                {milestone.emoji} {milestone.label}
              </span>
              {/* Delete */}
              {!confirmDelete ? (
                <button
                  type="button"
                  title="Delete habit"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-full p-1 text-[#d4e4cc]/30 transition hover:bg-red-500/20 hover:text-red-400"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9.5 2.5l-7 7M2.5 2.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onDelete(habit.id)}
                  onBlur={() => setConfirmDelete(false)}
                  autoFocus
                  className="rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-300 transition hover:bg-red-500/50"
                >
                  Confirm?
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <p className="mt-0.5 text-[10px] text-[#dce9d6]/55">
            {habit.trees.length} trees · best {longest}d streak
          </p>

          {/* Withered warning */}
          {withered && (
            <p className="mt-1 text-[10px] text-amber-400/85">⚠ Needs attention — check in today!</p>
          )}

          {/* Calendar + tree preview side by side */}
          <div className="mt-2 flex items-start gap-2">
            <div className="flex-1">
              <CalendarDots habit={habit} />
              <p className="mt-1.5 text-[10px] text-[#dce9d6]/60">
                {completedToday ? '✓ Tree planted for today' : 'Check off to plant a tree today'}
              </p>
            </div>
            <TreePreview species={habit.species} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ habits, todayStamp }) {
  const stats = useMemo(() => {
    const totalTrees = habits.reduce((s, h) => s + h.trees.length, 0)
    const bestStreak = habits.reduce((m, h) => Math.max(m, getLongestStreak(h)), 0)
    const completedToday = habits.filter(h => h.lastCompletedOn === todayStamp).length
    const witheredCount = habits.filter(h => isHabitWithered(h)).length
    const ratedHabits = habits.map(h => ({
      name: h.name,
      rate: getHabitCompletionRate(h, 30),
      streak: getHabitStreak(h),
      longest: getLongestStreak(h),
      trees: h.trees.length,
      milestone: getMilestone(h.trees.length),
    })).sort((a, b) => b.rate - a.rate)
    return { totalTrees, bestStreak, completedToday, witheredCount, ratedHabits }
  }, [habits, todayStamp])

  if (!habits.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#dce9d6]/50">
        No habits yet — add one to start your forest.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pr-1">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Trees', value: stats.totalTrees },
          { label: 'Best Streak', value: `${stats.bestStreak}d` },
          { label: 'Done Today', value: `${stats.completedToday}/${habits.length}` },
          { label: 'Need Attention', value: stats.witheredCount, warn: stats.witheredCount > 0 },
        ].map(({ label, value, warn }) => (
          <div key={label} className={`rounded-2xl border px-3 py-3 ${warn ? 'border-amber-400/30 bg-amber-950/20' : 'border-white/10 bg-black/12'}`}>
            <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/55">{label}</p>
            <p className={`mt-1.5 text-xl font-bold ${warn ? 'text-amber-300' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Per-habit completion bars */}
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-widest text-[#d4e4cc]/55">30-day completion rate</p>
        <div className="space-y-2.5">
          {stats.ratedHabits.map(h => (
            <div key={h.name}>
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="truncate text-[#dce9d6]/80">{h.milestone.emoji} {h.name}</span>
                <span className="ml-2 shrink-0 text-[#a8d878]">{h.rate}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7ac356] to-[#c2e88a] transition-all duration-500"
                  style={{ width: `${h.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-habit streak table */}
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-widest text-[#d4e4cc]/55">Streaks</p>
        <div className="space-y-1.5">
          {stats.ratedHabits.map(h => (
            <div key={h.name} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 py-2">
              <p className="truncate text-xs text-[#dce9d6]/80">{h.name}</p>
              <div className="flex shrink-0 gap-3 text-[10px] text-[#d4e4cc]/60">
                <span className="text-orange-300">🔥 {h.streak}d now</span>
                <span>best {h.longest}d</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Controls reference tab ─────────────────────────────────────────────────────
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])
  return isTouch
}

function Key({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] font-semibold text-white shadow-sm min-w-[28px]">
      {children}
    </kbd>
  )
}

function ControlRow({ keys, label }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">{keys.map((k, i) => <Key key={i}>{k}</Key>)}</div>
      <span className="text-[11px] text-[#dce9d6]/70">{label}</span>
    </div>
  )
}

function ControlsTab() {
  const isTouch = useIsTouchDevice()

  const touchSections = [
    {
      title: 'Camera',
      rows: [
        { keys: ['swipe with 1 finger'], label: 'Pan camera' },
        { keys: ['hold with one finger and swipe with another'], label: 'Orbit / rotate' },
        { keys: ['Pinch the screen with two fingers'], label: 'Zoom in / out' },
      ],
    },
    {
      title: 'Interact',
      rows: [
        { keys: ['Tap tree'], label: 'Select tree' },
        { keys: ['Tap area'], label: 'Zoom to grove' },
      ],
    },
  ]

  const desktopSections = [
    {
      title: 'Navigate',
      rows: [
        { keys: ['W', '↑'], label: 'Move forward' },
        { keys: ['S', '↓'], label: 'Move backward' },
        { keys: ['A', '←'], label: 'Move left' },
        { keys: ['D', '→'], label: 'Move right' },
      ],
    },
    {
      title: 'Mouse',
      rows: [
        { keys: ['LMB drag'], label: 'Pan camera' },
        { keys: ['RMB drag'], label: 'Orbit / rotate' },
        { keys: ['Scroll'], label: 'Zoom in / out' },
      ],
    },
    {
      title: 'Interact',
      rows: [
        { keys: ['Click tree'], label: 'Select tree' },
        { keys: ['Click area'], label: 'Zoom to grove' },
      ],
    },
  ]

  const sections = isTouch ? touchSections : desktopSections
  const tip = isTouch
    ? 'Tap a tree to inspect its habit. Switch to Area View in the Habits tab to see coloured grove overlays.'
    : 'Click a tree to inspect its habit. Switch to Area View in the Habits tab to see coloured grove overlays.'

  return (
    <div className="flex flex-col gap-5 overflow-y-auto pr-1">
      {sections.map(section => (
        <div key={section.title}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#d4e4cc]/55">
            {section.title}
          </p>
          <div className="space-y-2.5">
            {section.rows.map(row => (
              <ControlRow key={row.label} keys={row.keys} label={row.label} />
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
        <p className="text-[10px] font-semibold text-[#d4e4cc]/60 uppercase tracking-widest mb-1.5">Tip</p>
        <p className="text-[11px] leading-5 text-[#dce9d6]/65">
          {tip.split('Area View').map((part, i, arr) =>
            i < arr.length - 1
              ? [part, <span key={i} className="text-[#a8d878]">Area View</span>]
              : part
          )}
        </p>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
function HabitPanel({
  habits,
  isPending,
  todayStamp,
  sceneDateLabel,
  forestTotals,
  timeOfDay,
  viewMode,
  onAddHabit,
  onCompleteHabit,
  onSetTimeOfDay,
  onSetViewMode,
  onDeleteHabit,
  globalSeed,
  onSetGlobalSeed,
  terrainSettings,
  onSetTerrainSettings,
}) {
  const [draftHabit, setDraftHabit] = useState('')
  const [seedInput, setSeedInput] = useState(globalSeed)
  const [activeTab, setActiveTab] = useState('habits') // 'habits' | 'stats' | 'settings'

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = draftHabit.trim()
    if (!trimmed) return
    onAddHabit(trimmed)
    setDraftHabit('')
  }

  const witheredCount = useMemo(
    () => habits.filter(h => isHabitWithered(h)).length,
    [habits],
  )

  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(true)

  return (
    <>
      {/* ── Mobile FAB toggle ── */}
      <button
        type="button"
        aria-label={mobileOpen ? 'Close habit panel' : 'Open habit panel'}
        onClick={() => setMobileOpen(o => !o)}
        className="forest-panel pointer-events-auto fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-[#edf6ea] shadow-lg transition active:scale-95 md:hidden"
        style={{ backdropFilter: 'blur(24px)' }}
      >
        {mobileOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l14 14M16 2L2 16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        )}
      </button>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Desktop collapsed peek-tab ── */}
      <button
        type="button"
        aria-label="Open habit panel"
        onClick={() => setDesktopOpen(true)}
        className={[
          'forest-panel pointer-events-auto fixed left-0 top-5 z-50 hidden flex-row items-center gap-2 rounded-r-2xl border-l-0 px-3 py-2.5 text-[#edf6ea] shadow-lg transition-all duration-300 md:flex',
          desktopOpen ? 'opacity-0 pointer-events-none -translate-x-full' : 'opacity-100 translate-x-0',
        ].join(' ')}
      >
        {/* Chevron right */}
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2l6 5-6 5" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4e4cc]/80">
          Habits
        </span>
        {/* Tree count badge */}
        {forestTotals.treeCount > 0 && (
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {forestTotals.treeCount}
          </span>
        )}
        {witheredCount > 0 && (
          <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
            ⚠
          </span>
        )}
      </button>

      <aside
        className={[
          'forest-panel pointer-events-auto fixed flex flex-col overflow-hidden text-[#edf6ea]',
          // Desktop: left sidebar, slides off left when collapsed
          'md:left-0 md:top-0 md:bottom-0 md:h-screen md:w-[22rem] md:rounded-r-[28px] md:rounded-l-none md:p-6',
          desktopOpen ? 'md:translate-x-0' : 'md:-translate-x-full',
          // Mobile: bottom sheet
          'left-0 right-0 bottom-0 h-[82vh] w-full rounded-t-[28px] rounded-b-none p-4',
          'transition-transform duration-300 ease-out z-40',
          mobileOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0',
        ].join(' ')}
      >
        {/* ── Drag handle (mobile only) ── */}
        <div className="mb-3 flex justify-center shrink-0 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#d4e4cc]/80">Habit Forest</p>
            <p className="mt-0.5 text-[10px] text-[#d4e4cc]/50">{sceneDateLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-[#eff8ea]/80">
              <span className="font-semibold text-white">{forestTotals.treeCount}</span> trees
            </div>
            {witheredCount > 0 && (
              <div className="rounded-full border border-amber-400/40 bg-amber-900/25 px-2.5 py-1.5 text-[10px] font-semibold text-amber-300">
                ⚠ {witheredCount}
              </div>
            )}
            {/* Desktop collapse button */}
            <button
              type="button"
              aria-label="Collapse panel"
              onClick={() => setDesktopOpen(false)}
              className="hidden rounded-full p-1.5 text-[#d4e4cc]/50 transition hover:bg-white/10 hover:text-white md:flex items-center justify-center"
              title="Collapse panel"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2L4 7l6 5" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Add habit form ── */}
        <form className="mt-4 flex gap-2 shrink-0" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draftHabit}
            onChange={e => setDraftHabit(e.target.value)}
            placeholder="New habit name…"
            className="forest-input min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/15 px-4 py-2.5 text-sm text-white placeholder:text-[#d8e7d2]/45"
          />
          <button
            type="submit"
            disabled={isPending || !draftHabit.trim()}
            className="rounded-2xl bg-[#b8d890] px-4 py-2.5 text-sm font-semibold text-[#1e3018] transition hover:bg-[#cdeaa8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {/* ── Tab bar ── */}
        <div className="mt-3 flex gap-1 rounded-full border border-white/10 bg-black/12 p-1 shrink-0">
          {[
            { id: 'habits', label: 'Habits' },
            { id: 'stats', label: 'Stats' },
            { id: 'settings', label: 'Settings' },
            { id: 'controls', label: 'Controls' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${activeTab === tab.id
                ? 'bg-white/18 text-white'
                : 'text-[#d8e7d2]/65 hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content area ── */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">

          {/* HABITS TAB */}
          {activeTab === 'habits' && (
            <>
              {/* View toggles (Trees / Areas) */}
              <div className="mb-3 flex justify-end shrink-0">
                <div className="flex rounded-full border border-white/10 bg-black/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => onSetViewMode('forest')}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${viewMode === 'forest' ? 'bg-white/18 text-white' : 'text-[#d8e7d2]/60 hover:text-white'}`}
                  >Trees</button>
                  <button
                    type="button"
                    onClick={() => onSetViewMode('areas')}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${viewMode === 'areas' ? 'bg-white/18 text-white' : 'text-[#d8e7d2]/60 hover:text-white'}`}
                  >Areas</button>
                </div>
              </div>

              {/* Habit list */}
              <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">
                {habits.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/15 bg-black/8 px-5 py-8 text-center text-sm text-[#e3efde]/55">
                    Your clearing is quiet.<br />Add your first habit above.
                  </div>
                ) : (
                  habits.map(habit => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      completedToday={habit.lastCompletedOn === todayStamp}
                      isPending={isPending}
                      todayStamp={todayStamp}
                      onComplete={onCompleteHabit}
                      onDelete={onDeleteHabit}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <StatsTab habits={habits} todayStamp={todayStamp} />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-5 overflow-y-auto pr-1">
              {/* Sun arc time-of-day slider */}
              <SunArcSlider timeOfDay={timeOfDay} onSetTimeOfDay={onSetTimeOfDay} />

              {/* Forest seed */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#d4e4cc]/60">Forest Seed</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seedInput}
                    onChange={e => setSeedInput(e.target.value)}
                    className="forest-input min-w-0 flex-1 rounded-xl border border-white/15 bg-black/15 px-3 py-2 text-sm uppercase text-white placeholder:text-[#d8e7d2]/45"
                    placeholder="Enter seed"
                    maxLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (seedInput.trim() && seedInput !== globalSeed) onSetGlobalSeed(seedInput.trim())
                    }}
                    disabled={!seedInput.trim() || seedInput.trim() === globalSeed || isPending}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-[#d4e4cc]/45">
                  Changing the seed regenerates the entire world terrain.
                </p>
              </div>

              {/* Terrain sliders */}
              {terrainSettings && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4e4cc]/60">Terrain</p>
                    <button
                      type="button"
                      onClick={() => onSetTerrainSettings(s => ({ ...s, amplitude: 1.1, lowFrequency: 1, detailFrequency: 1, edgeSoftness: 1 }))}
                      className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-[#d4e4cc]/65 transition hover:bg-white/10"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="space-y-3">
                    {TERRAIN_SLIDERS.map(slider => (
                      <label key={slider.id} className="block">
                        <div className="mb-1 flex justify-between text-[10px] text-[#dce9d6]/75">
                          <span>{slider.label}</span>
                          <span className="text-[#a8d878]">{terrainSettings[slider.id].toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={slider.min}
                          max={slider.max}
                          step={slider.step}
                          value={terrainSettings[slider.id]}
                          onChange={e => onSetTerrainSettings(cur => ({ ...cur, [slider.id]: Number(e.target.value) }))}
                          className="w-full accent-[#a8d878]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTROLS TAB */}
          {activeTab === 'controls' && <ControlsTab />}
        </div>
      </aside>
    </>
  )
}

export default HabitPanel
