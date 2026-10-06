import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import Tree from './Tree'
import HoldToDeleteButton from './HoldToDeleteButton'
import {
  dayKey,
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



const PREVIEW_TREE = {
  id: 'preview', x: 0, z: 0,
  scale: 1, heightScale: 1, trunkScale: 1, crownScale: 1,
  rotation: 0, crownOffsetX: 0, crownOffsetZ: 0,
  leanX: 0, leanZ: 0, phase: Math.PI / 3, accentMix: 0.5,
  plantedAt: Date.now() - 30000, // pre-grown, no animation
}

function calculateTreeFraming(species) {
  if (!species) {
    return { yOffset: -1.5, cameraDistance: 7.5, fov: 42 }
  }

  const trunkHeight = species.trunkHeight ?? 2.6
  const crownLift = species.crownLift ?? 0.84
  const canopyHeight = species.canopyHeight ?? 2.2
  const canopyWidth = species.canopyWidth ?? 1.8
  const leafSize = species.leafSize ?? 0.85
  const canopyType = species.canopyType || 'rounded'
  const trunkThickness = species.trunkThickness ?? 0.28

  // Canopy base in tree coordinates
  const canopyBaseY = trunkHeight * crownLift

  let canopyRelTop = canopyHeight
  let canopyRelBottom = 0
  let maxCanopyRadius = canopyWidth * 0.75

  if (canopyType === 'conifer') {
    // 3 cone tiers:
    // Top cone is at y = canopyHeight * 0.93 with scale = canopyWidth * 0.56
    // Shared cone geometry height is 1.8, extending +0.9 * scale above its position
    canopyRelTop = canopyHeight * 0.93 + 0.9 * (canopyWidth * 0.56)
    // Bottom cone is at y = canopyHeight * 0.12 with scale = canopyWidth * 0.92
    canopyRelBottom = canopyHeight * 0.12 - 0.9 * (canopyWidth * 0.92)
    maxCanopyRadius = 0.95 * (canopyWidth * 0.92)
  } else {
    // rounded or hybrid:
    // Top central orb is at y = canopyHeight * 0.52 with scale = leafSize * 1.08 (Ico radius 1)
    const centralOrbTop = canopyHeight * 0.52 + leafSize * 1.08
    // Clustered leaves up to y = canopyHeight * 0.34 with scale up to leafSize * 1.06
    const clusterTop = canopyHeight * 0.34 + (canopyType === 'hybrid' ? 0.9 : 1.0) * (leafSize * 1.06)
    canopyRelTop = Math.max(centralOrbTop, clusterTop)
    canopyRelBottom = canopyHeight * 0.16 - leafSize * 1.06
    maxCanopyRadius = canopyWidth * 0.52 + leafSize * 1.06
  }

  // Trunk underground is -1.2 in Tree.jsx (fullTrunkHeight extends from -1.2 to trunkHeight)
  const trunkBottom = -1.2
  const trunkTop = trunkHeight

  // Account for outline meshes (scale multiplier 1.05 - 1.20) and gentle sway
  const outlineTopPadding = canopyType === 'conifer' ? 0.25 * (canopyWidth * 0.56) : 0.2 * (leafSize * 1.08)
  const rawTop = Math.max(trunkTop, canopyBaseY + canopyRelTop) + outlineTopPadding
  const rawBottom = Math.min(trunkBottom, canopyBaseY + canopyRelBottom) - 0.1

  // Outer group scale in TreePreview is 1.02
  const scaleMul = 1.02
  const top = rawTop * scaleMul
  const bottom = rawBottom * scaleMul
  const totalHeight = Math.max(1.5, top - bottom)
  const totalWidth = Math.max(1.2, Math.max(maxCanopyRadius * 2, trunkThickness * 2.5) * scaleMul)
  const visualCenterY = (top + bottom) / 2

  // Container dimensions: width 92px, height 118px -> aspect ratio approx 0.7797
  const aspect = 92 / 118
  const fov = 42
  const tanFovHalf = Math.tan(((fov / 2) * Math.PI) / 180)

  // 26% breathing room padding so the tree apex and base never touch card boundaries
  const paddingFactor = 1.26
  const distForHeight = (totalHeight * paddingFactor) / (2 * tanFovHalf)
  const distForWidth = (totalWidth * paddingFactor) / (2 * tanFovHalf * aspect)
  const cameraDistance = Math.max(distForHeight, distForWidth, 5.8)

  return {
    yOffset: -visualCenterY,
    cameraDistance,
    fov,
  }
}

function CameraController({ distance, fov }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0.25, 0, distance)
    camera.fov = fov
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, distance, fov])
  return null
}

function SpinGroup({ children, yOffset }) {
  const ref = useRef(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.55 })
  return <group ref={ref} position={[0, yOffset, 0]}>{children}</group>
}

function TreePreview({ species }) {
  const { yOffset, cameraDistance, fov } = useMemo(
    () => calculateTreeFraming(species),
    [species]
  )

  return (
    <div className="shrink-0 rounded-xl overflow-hidden -translate-x-2" style={{ width: 92, height: 118 }}>
      <Canvas
        camera={{ position: [0.25, 0, cameraDistance], fov, near: 0.2, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <CameraController distance={cameraDistance} fov={fov} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[5, 8, 5]} intensity={1.15} />
        <SpinGroup yOffset={yOffset}>
          <group scale={1.02}>
            <Tree
              species={species}
              tree={PREVIEW_TREE}
              mappedPosition={[0, 0, 0]}
              isSelected={false}
            />
          </group>
        </SpinGroup>
      </Canvas>
    </div>
  )
}


const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// ── Ongoing month tracking calendar (Sun - Sat) ─────────────────────────────
function CalendarDots({ habit, onToggleToday }) {
  const todayMs = useMemo(() => dayKey(Date.now()), [])

  const { weeks } = useMemo(() => {
    const done = new Set(habit.trees.map(t => dayKey(t.plantedAt)))
    const now = new Date(todayMs)
    const year = now.getFullYear()
    const month = now.getMonth() // 0-indexed
    const todayDate = now.getDate()

    // 1st day of the current month
    const firstDay = new Date(year, month, 1)
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday, 6 = Saturday

    // Total days in the current month
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []

    // 1. Empty padding cells before the 1st of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ isEmpty: true, id: `pre-${i}` })
    }

    // 2. Day cells for 1..daysInMonth
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      date.setHours(0, 0, 0, 0)
      const ms = date.getTime()
      const isToday = d === todayDate
      const isFuture = ms > todayMs

      cells.push({
        isEmpty: false,
        id: `day-${d}`,
        dayNumber: d,
        ms,
        completed: done.has(ms),
        isToday,
        isFuture,
      })
    }

    // 3. Trailing empty padding cells to complete the last row
    const remainder = cells.length % 7
    if (remainder > 0) {
      const needed = 7 - remainder
      for (let i = 0; i < needed; i++) {
        cells.push({ isEmpty: true, id: `post-${i}` })
      }
    }

    // 4. Split into rows of 7
    const weekRows = []
    for (let i = 0; i < cells.length; i += 7) {
      weekRows.push(cells.slice(i, i + 7))
    }

    return { weeks: weekRows }
  }, [habit, todayMs])

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Weekday column indicators: Sunday to Saturday */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-[8px] font-semibold text-[#d4e4cc]/45 uppercase">
            {label}
          </span>
        ))}
      </div>

      {/* Current month calendar grid with boxes in place of dates */}
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, di) => {
              if (cell.isEmpty) {
                return <div key={cell.id || di} className="aspect-square w-full" />
              }

              const { isToday, isFuture, completed, ms, dayNumber } = cell
              const dateStr = new Date(ms).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              const titleText = isToday
                ? `Today (${dateStr}) • ${completed ? 'Completed ✓ (click to undo)' : 'Not completed (click to check off)'}`
                : isFuture
                  ? `${dateStr} • Upcoming`
                  : `${dateStr} • ${completed ? 'Planted tree ✓' : 'No tree planted'}`

              return (
                <div
                  key={cell.id || dayNumber}
                  role={isToday ? 'button' : undefined}
                  tabIndex={isToday ? 0 : undefined}
                  onClick={isToday ? onToggleToday : undefined}
                  onKeyDown={isToday ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleToday(); } } : undefined}
                  title={titleText}
                  className={`aspect-square w-full rounded-[4px] transition-all flex items-center justify-center ${
                    isToday
                      ? completed
                        ? 'bg-[#a8d878] ring-2 ring-[#a8d878]/55 shadow-[0_0_8px_rgba(168,216,120,0.4)] cursor-pointer hover:scale-105 active:scale-95'
                        : 'bg-[#a8d878]/15 border border-dashed border-[#a8d878]/70 hover:bg-[#a8d878]/30 cursor-pointer hover:scale-105 active:scale-95'
                      : isFuture
                        ? 'bg-white/[0.04] border border-white/[0.03] cursor-default'
                        : completed
                          ? 'bg-[#a8d878]/90 hover:brightness-110 shadow-[0_0_4px_rgba(168,216,120,0.2)]'
                          : 'bg-white/[0.08] border border-white/[0.04] hover:bg-white/[0.14]'
                  }`}
                >
                  {isToday && (
                    <span
                      className={`block h-1.5 w-1.5 rounded-full ${
                        completed ? 'bg-[#182a12]' : 'bg-[#a8d878] animate-pulse'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Single habit card ─────────────────────────────────────────────────────────
function HabitCard({ habit, completedToday, isPending, onComplete, onUncomplete, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const streak  = useMemo(() => getHabitStreak(habit),   [habit])
  const longest = useMemo(() => getLongestStreak(habit), [habit])
  const milestone = useMemo(() => getMilestone(habit.trees.length), [habit])
  const withered  = useMemo(() => isHabitWithered(habit), [habit])

  function handleCheckboxClick() {
    if (isPending) return
    if (completedToday) onUncomplete(habit.id)
    else                onComplete(habit.id)
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 transition-all ${withered
        ? 'border-amber-400/45 bg-amber-950/25'
        : 'border-white/10 bg-black/12 hover:border-white/20 hover:bg-black/18'
        }`}
    >
      {/* Row 1: name + badges + delete */}
      <div>
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
          {habit.trees.length} {habit.trees.length === 1 ? 'tree' : 'trees'}
        </p>

        {/* Withered warning */}
        {withered && (
          <p className="mt-1 text-[10px] text-amber-400/85">⚠ Needs attention — check in today!</p>
        )}

        {/* Calendar + tree preview side by side */}
        <div className="mt-2.5 flex items-start gap-2">
          <div className="flex-1 min-w-0 max-w-[145px]">
            <CalendarDots habit={habit} onToggleToday={handleCheckboxClick} />
          </div>
          <TreePreview species={habit.species} />
        </div>
      </div>

      {/* Bottom left corner of card */}
      <button
        type="button"
        onClick={handleCheckboxClick}
        disabled={isPending}
        className={`mt-2 text-left text-[10px] transition-colors cursor-pointer hover:underline ${
          completedToday ? 'text-[#a8d878]/80' : 'text-[#dce9d6]/50 hover:text-[#dce9d6]/80'
        }`}
      >
        {completedToday ? 'Tree planted today' : 'Plant a tree today'}
      </button>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ habits, todayStamp }) {
  const DAY_MS = 86400000

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

  const weeklyData = useMemo(() => {
    const todayMs = dayKey(Date.now())
    const days = []
    let totalPlantedThisWeek = 0

    for (let i = 6; i >= 0; i--) {
      const ms = todayMs - i * DAY_MS
      const date = new Date(ms)
      const dayLabel = date.toLocaleDateString(undefined, { weekday: 'short' })
      const isToday = i === 0

      // Count trees planted on this day across all habits
      let count = 0
      habits.forEach(h => {
        h.trees.forEach(t => {
          if (dayKey(t.plantedAt) === ms) {
            count++
          }
        })
      })

      totalPlantedThisWeek += count
      days.push({ ms, dayLabel, count, isToday })
    }

    const maxCount = Math.max(1, habits.length, ...days.map(d => d.count))
    return { days, totalPlantedThisWeek, maxCount }
  }, [habits])

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

      {/* ── 7-Day Activity Graph ── */}
      <div className="rounded-2xl border border-white/10 bg-black/12 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/55">Weekly Activity</p>
            <p className="text-xs font-semibold text-white/90 mt-0.5">
              {weeklyData.totalPlantedThisWeek} {weeklyData.totalPlantedThisWeek === 1 ? 'tree' : 'trees'} planted this week
            </p>
          </div>
          <span className="rounded-full bg-[#a8d878]/15 border border-[#a8d878]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#a8d878]">
            7-Day Graph
          </span>
        </div>

        {/* Bar chart grid */}
        <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-2 pb-1 px-1">
          {weeklyData.days.map((day, idx) => {
            const heightPercent = day.count > 0
              ? Math.max(20, Math.round((day.count / weeklyData.maxCount) * 100))
              : 8

            return (
              <div key={day.ms || idx} className="flex flex-col items-center h-full justify-end gap-1.5 group">
                {/* Count indicator */}
                <span className={`text-[9px] font-bold transition-all ${
                  day.count > 0 ? 'text-[#a8d878]' : 'text-white/20'
                }`}>
                  {day.count > 0 ? day.count : '0'}
                </span>

                {/* Vertical Bar Track */}
                <div className="w-full max-w-[24px] h-16 rounded-lg bg-white/[0.04] p-0.5 flex flex-col justify-end overflow-hidden border border-white/[0.04]">
                  <div
                    className={`w-full rounded-md transition-all duration-500 ${
                      day.count > 0
                        ? 'bg-gradient-to-t from-[#528d39] to-[#a8d878] shadow-[0_0_8px_rgba(168,216,120,0.35)]'
                        : 'bg-white/[0.08]'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>

                {/* Day of week */}
                <span className={`text-[9px] font-semibold transition-colors ${
                  day.isToday ? 'text-[#a8d878] font-bold' : 'text-[#d4e4cc]/45'
                }`}>
                  {day.dayLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-habit completion bars */}
      <div className="rounded-2xl border border-white/10 bg-black/12 p-3.5">
        <p className="mb-2.5 text-[10px] uppercase tracking-widest text-[#d4e4cc]/55">30-day completion rate</p>
        <div className="space-y-3">
          {stats.ratedHabits.map(h => (
            <div key={h.name}>
              <div className="mb-1.5 flex justify-between text-[10px]">
                <span className="truncate text-[#dce9d6]/85 font-medium">{h.milestone.emoji} {h.name}</span>
                <span className="ml-2 shrink-0 font-bold text-[#a8d878]">{h.rate}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#528d39] to-[#a8d878] transition-all duration-500"
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
        <div className="space-y-2">
          {stats.ratedHabits.map(h => (
            <div
              key={h.name}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/12 px-3.5 py-3 transition hover:border-white/20 hover:bg-black/16"
            >
              <div className="min-w-0 pr-2">
                <p className="truncate text-xs font-semibold text-[#dce9d6]/90">
                  {h.milestone.emoji} {h.name}
                </p>
                <p className="text-[10px] text-[#d4e4cc]/45 mt-0.5">
                  {h.trees} {h.trees === 1 ? 'tree' : 'trees'} planted
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[10px]">
                <span className={`rounded-full px-2.5 py-0.5 font-semibold ${
                  h.streak > 0
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'bg-white/5 text-[#d4e4cc]/40 border border-white/10'
                }`}>
                  🔥 {h.streak}d now
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[#d4e4cc]/70">
                  best {h.longest}d
                </span>
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
        { keys: ['1 finger swipe'], label: 'Pan camera' },
        { keys: ['2 finger swipe'], label: 'Orbit / rotate' },
        { keys: ['Pinch'], label: 'Zoom in / out' },
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
        { keys: ['Q', 'E'], label: 'Orbit horizontally' },
        { keys: ['I', 'K'], label: 'Orbit vertically' },
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
      <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 shadow-sm">
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
  viewMode,
  onAddHabit,
  onCompleteHabit,
  onUncompleteHabit,
  onSetViewMode,
  onDeleteHabit,
  globalSeed,
  onSetGlobalSeed,
  terrainSettings,
  onSetTerrainSettings,
  onResetProgress,
  onOpenLegal,
  isMuted,
  onToggleMute,
}) {
  const [draftHabit, setDraftHabit] = useState('')
  const [isAddingHabit, setIsAddingHabit] = useState(false)
  const [seedInput, setSeedInput] = useState(globalSeed)
  const [activeTab, setActiveTab] = useState('habits') // 'habits' | 'stats' | 'settings'

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = draftHabit.trim()
    if (!trimmed) return
    onAddHabit(trimmed)
    setDraftHabit('')
    setIsAddingHabit(false)
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
        data-tutorial="mobile-fab"
        aria-label={mobileOpen ? 'Close habit panel' : 'Open habit panel'}
        onClick={() => setMobileOpen(o => !o)}
        className="forest-panel pointer-events-auto fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-[#edf6ea] shadow-lg transition active:scale-95 md:hidden mb-[env(safe-area-inset-bottom,0px)] mr-[env(safe-area-inset-right,0px)]"
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
          'forest-panel pointer-events-auto fixed left-0 top-5 z-50 hidden flex-row items-center justify-center rounded-r-2xl border-l-0 px-2.5 py-3 text-[#edf6ea] shadow-lg transition-all duration-300 md:flex hover:text-white',
          desktopOpen ? 'opacity-0 pointer-events-none -translate-x-full' : 'opacity-100 translate-x-0',
        ].join(' ')}
      >
        {/* Chevron right */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2l6 5-6 5" />
        </svg>
      </button>

      <aside
        data-tutorial="habit-panel"
        className={[
          'forest-panel pointer-events-auto fixed flex flex-col overflow-hidden text-[#edf6ea]',
          // Desktop: left sidebar, slides off left when collapsed
          'md:left-0 md:top-0 md:bottom-0 md:h-screen md:w-[22rem] md:rounded-r-[28px] md:rounded-l-none md:p-6',
          desktopOpen ? 'md:translate-x-0' : 'md:-translate-x-full',
          // Mobile: bottom sheet
          'left-0 right-0 bottom-0 h-[82dvh] w-full rounded-t-[28px] rounded-b-none p-4 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]',
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

        {/* ── Tab bar ── */}
        <div className="mt-3.5 flex gap-1 rounded-full border border-white/10 bg-black/12 p-1 shrink-0">
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
              data-tutorial={tab.id === 'stats' ? 'tab-stats' : tab.id === 'settings' ? 'tab-settings' : tab.id === 'controls' ? 'tab-controls' : undefined}
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
              {/* Toolbar: [+] on the left, [Trees | Areas] on the right */}
              <div className="mb-3 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingHabit(prev => !prev)}
                  data-tutorial="habit-add-form"
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition active:scale-95 bg-transparent border-0 ${
                    isAddingHabit
                      ? 'text-[#a8d878]'
                      : 'text-white/75 hover:text-white'
                  }`}
                  title={isAddingHabit ? 'Close' : 'Add new habit'}
                  aria-label="Add new habit"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${isAddingHabit ? 'rotate-45' : ''}`}
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <div className="flex rounded-full border border-white/10 bg-black/10 p-0.5" data-tutorial="view-toggle">
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

              {/* Collapsible inline Add Habit row */}
              {isAddingHabit && (
                <form
                  className="mb-3 flex gap-2 shrink-0 animate-in fade-in duration-150"
                  onSubmit={handleSubmit}
                >
                  <input
                    type="text"
                    autoFocus
                    value={draftHabit}
                    onChange={e => setDraftHabit(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        setIsAddingHabit(false)
                      }
                    }}
                    placeholder="New habit name…"
                    className="forest-input min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-white placeholder:text-[#d8e7d2]/45"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !draftHabit.trim()}
                    className="rounded-xl bg-[#b8d890] px-3.5 py-1.5 text-xs font-semibold text-[#1e3018] transition hover:bg-[#cdeaa8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              )}

              {/* Habit list */}
              <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5" data-tutorial="habit-list">
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
                      onUncomplete={onUncompleteHabit}
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
              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4e4cc]/60">Sound Effects</p>
                  <p className="mt-0.5 text-[10px] text-[#d4e4cc]/40">Chimes when a habit is completed</p>
                </div>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                    !isMuted
                      ? 'border-[#a8d878]/50 bg-[#a8d878]/30'
                      : 'border-white/15 bg-black/20'
                  }`}
                  aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  <span
                    className={`absolute h-4 w-4 rounded-full shadow transition-all duration-200 ${
                      !isMuted ? 'left-[calc(100%-1.25rem)] bg-[#a8d878]' : 'left-1 bg-white/40'
                    }`}
                  />
                </button>
              </div>

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

              {/* Reset & Progress Deletion (Hold to confirm) */}
              <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-3.5 mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs">⚠️</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                    Danger Zone
                  </p>
                </div>
                <p className="text-[11px] text-[#e0cfcf]/70 leading-relaxed mb-3">
                  Permanently delete all habits, trees, points, and placed decorations. This will reset your progress back to the beginning.
                </p>
                <HoldToDeleteButton
                  onConfirm={onResetProgress}
                  holdDuration={2000}
                  label="Hold to Delete All Progress"
                  confirmLabel="Progress Deleted! Resetting…"
                />
              </div>

              {/* Privacy, Terms, and Local Storage info */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#d4e4cc]/60 px-1">
                <span>100% On-Device • Zero Trackers</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenLegal?.('privacy')}
                    className="hover:text-white transition underline"
                  >
                    Privacy
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => onOpenLegal?.('terms')}
                    className="hover:text-white transition underline"
                  >
                    Terms
                  </button>
                </div>
              </div>
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
