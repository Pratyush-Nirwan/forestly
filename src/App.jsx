import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import HabitPanel from './components/HabitPanel'
import {
  completeHabitForToday,
  createHabitRecord,
  DEFAULT_TERRAIN_SETTINGS,
  deleteHabit,
  getForestTotals,
  getSceneDateLabel,
  getTodayStamp,
  loadHabits,
  loadTerrainSettings,
  loadSceneSetting,
  saveHabits,
  saveTerrainSettings,
  saveSceneSetting,
  createDemoHabits,
  loadGlobalSeed,
  saveGlobalSeed,
} from './lib/forest'

const ForestScene = lazy(() => import('./components/ForestScene'))
const TERRAIN_SLIDERS = [
  {
    id: 'amplitude',
    label: 'Elevation',
    min: 0.2,
    max: 1.4,
    step: 0.05,
  },
  {
    id: 'lowFrequency',
    label: 'Hill Size',
    min: 0.5,
    max: 1.8,
    step: 0.05,
  },
  {
    id: 'detailFrequency',
    label: 'Roughness',
    min: 0.5,
    max: 2.1,
    step: 0.05,
  },
  {
    id: 'edgeSoftness',
    label: 'Edge Smoothing',
    min: 0.3,
    max: 2,
    step: 0.05,
  },
]

function App() {
  const isDemo = typeof window !== 'undefined' && window.location.pathname === '/demo'
  const [globalSeed, setGlobalSeed] = useState(loadGlobalSeed)
  const [habits, setHabits] = useState(() => (isDemo ? createDemoHabits() : loadHabits()))
  const [timeOfDay, setTimeOfDay] = useState(loadSceneSetting)
  const [focusTarget, setFocusTarget] = useState(null)
  const [viewMode, setViewMode] = useState('forest')
  const [selectedTreeInfo, setSelectedTreeInfo] = useState(null)
  const [hoveredAreaInfo, setHoveredAreaInfo] = useState(null)
  const [terrainSettings, setTerrainSettings] = useState(loadTerrainSettings)
  const [isPending, startTransition] = useTransition()
  const deferredHabits = useDeferredValue(habits)
  const pendingFocusRef = useRef(null)
  const todayStamp = getTodayStamp()
  const forestTotals = getForestTotals(habits)
  const sceneDateLabel = getSceneDateLabel()

  useEffect(() => {
    if (!isDemo) {
      saveHabits(habits)
    }
  }, [habits, isDemo])

  useEffect(() => {
    saveSceneSetting(timeOfDay)
  }, [timeOfDay])

  useEffect(() => {
    saveTerrainSettings(terrainSettings)
  }, [terrainSettings])

  useEffect(() => {
    if (!pendingFocusRef.current) {
      return
    }

    setFocusTarget(pendingFocusRef.current)
    pendingFocusRef.current = null
  }, [habits])

  useEffect(() => {
    if (!focusTarget) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFocusTarget(null)
    }, 4200)

    return () => window.clearTimeout(timeoutId)
  }, [focusTarget])

  function handleAddHabit(name) {
    startTransition(() => {
      setHabits((currentHabits) => {
        const result = createHabitRecord(name, currentHabits)
        if (result.plantedTree) {
          pendingFocusRef.current = {
            key: result.plantedTree.id,
            x: result.plantedTree.x,
            z: result.plantedTree.z,
          }
        }
        return result.nextHabits
      })
    })
  }

  function handleCompleteHabit(habitId) {
    startTransition(() => {
      setHabits((currentHabits) => {
        const result = completeHabitForToday(habitId, currentHabits)

        if (result.plantedTree) {
          pendingFocusRef.current = {
            key: result.plantedTree.id,
            x: result.plantedTree.x,
            z: result.plantedTree.z,
          }
        }

        return result.nextHabits
      })
    })
  }

  function handleDeleteHabit(habitId) {
    startTransition(() => {
      setHabits(current => deleteHabit(habitId, current))
    })
  }

  function handleSetGlobalSeed(newSeed) {
    const lowerSeed = newSeed.toLowerCase()
    saveGlobalSeed(lowerSeed)
    setGlobalSeed(lowerSeed)
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#b0c5b2] text-white">
      <Suspense fallback={<div className="fixed inset-0 bg-[#a9c3ad]" />}>
        <ForestScene
          habits={deferredHabits}
          focusTarget={focusTarget}
          timeOfDay={timeOfDay}
          viewMode={viewMode}
          terrainSettings={terrainSettings}
          selectedTreeId={selectedTreeInfo?.treeId ?? null}
          onTreeSelect={setSelectedTreeInfo}
          onAreaHover={setHoveredAreaInfo}
          globalSeed={globalSeed}
        />
      </Suspense>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_42%),linear-gradient(180deg,rgba(15,34,24,0.1),rgba(17,31,22,0.38))]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-4 md:px-6 md:pt-6">
        <div className="forest-panel pointer-events-auto rounded-[28px] px-6 py-2.5 text-center text-[#eef8ea]/90">
          <p className="text-sm font-medium">{sceneDateLabel}</p>
          <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#d4e4cc]/85">
            {forestTotals.treeCount} trees growing
          </p>
        </div>
      </div>


      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-3 p-3 md:p-6">
        <HabitPanel
          habits={habits}
          isPending={isPending}
          todayStamp={todayStamp}
          sceneDateLabel={sceneDateLabel}
          forestTotals={forestTotals}
          timeOfDay={timeOfDay}
          viewMode={viewMode}
          onAddHabit={handleAddHabit}
          onCompleteHabit={handleCompleteHabit}
          onSetTimeOfDay={setTimeOfDay}
          onSetViewMode={setViewMode}
          onDeleteHabit={handleDeleteHabit}
          globalSeed={globalSeed}
          onSetGlobalSeed={handleSetGlobalSeed}
          terrainSettings={terrainSettings}
          onSetTerrainSettings={setTerrainSettings}
        />

        {/* ── Bottom-right info panel ── */}
        {(selectedTreeInfo || hoveredAreaInfo) && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 md:bottom-6 md:right-6">
            <div className="forest-panel pointer-events-auto w-72 rounded-[24px] px-5 py-4 text-[#eef8ea]">
              {selectedTreeInfo ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4e4cc]/60">
                    Selected Tree
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="text-base font-bold text-white leading-tight">{selectedTreeInfo.habitName}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {selectedTreeInfo.streak > 0 && (
                        <span className="rounded-full bg-orange-500/25 px-2 py-0.5 text-xs font-semibold text-orange-300">
                          🔥 {selectedTreeInfo.streak}d
                        </span>
                      )}
                      {selectedTreeInfo.milestone && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-[#d4e4cc]/80">
                          {selectedTreeInfo.milestone.emoji} {selectedTreeInfo.milestone.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: selectedTreeInfo.species.leafColor }}
                    />
                    <span
                      className="h-3 w-3 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: selectedTreeInfo.species.barkColor }}
                    />
                    <span className="text-xs text-[#dce9d6]/65 capitalize">{selectedTreeInfo.species.canopyType} canopy</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Days</p>
                      <p className="mt-1 text-lg font-bold text-white">{selectedTreeInfo.daysCompleted}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Trees</p>
                      <p className="mt-1 text-lg font-bold text-white">{selectedTreeInfo.treeCount}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#d4e4cc]/50">
                    Planted {new Date(selectedTreeInfo.plantedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </>
              ) : hoveredAreaInfo ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4e4cc]/60">
                    Grove Overview
                  </p>
                  <p className="mt-2 text-base font-bold text-white">{hoveredAreaInfo.habitName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Days</p>
                      <p className="mt-1 text-lg font-bold text-white">{hoveredAreaInfo.daysCompleted}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Trees</p>
                      <p className="mt-1 text-lg font-bold text-white">{hoveredAreaInfo.treeCount}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#d4e4cc]/50">Click the area to zoom in</p>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default App
