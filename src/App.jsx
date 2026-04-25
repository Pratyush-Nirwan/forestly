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
        pendingFocusRef.current = {
          key: result.plantedTree.id,
          x: result.plantedTree.x,
          z: result.plantedTree.z,
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

      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden md:block md:right-6 md:top-6">
        <section className="forest-panel pointer-events-auto w-full max-w-[16rem] rounded-[28px] px-5 py-4 text-[#eef8ea]/85">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-[#dce9d4]/85">
              Terrain
            </p>
            <button
              type="button"
              onClick={() => setTerrainSettings({ ...DEFAULT_TERRAIN_SETTINGS })}
              className="rounded-full border border-white/20 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ebf6e6]/80 transition hover:bg-white/10"
            >
              Reset
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {TERRAIN_SLIDERS.map((slider) => (
              <label key={slider.id} className="block">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>{slider.label}</span>
                  <span className="text-[#d8e7d2]/80">
                    {terrainSettings[slider.id].toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={terrainSettings[slider.id]}
                  onChange={(event) =>
                    setTerrainSettings((current) => ({
                      ...current,
                      [slider.id]: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-[#d7ebb9]"
                />
              </label>
            ))}
          </div>
        </section>
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
        />

        <div className="pointer-events-none hidden items-end justify-end md:flex">
          <div className="forest-panel pointer-events-auto max-w-xs rounded-[28px] px-5 py-4 text-right text-sm leading-6 text-[#eef8ea]/78">
            {selectedTreeInfo ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-[#dce9d4]/85">
                  Selected Tree
                </p>
                <p className="mt-1 font-semibold text-[#f6fbf3]">
                  {selectedTreeInfo.habitName}
                </p>
                <p className="mt-1">
                  {selectedTreeInfo.daysCompleted}
                  {' '}
                  days completed
                </p>
                <p>{selectedTreeInfo.treeCount} trees in this habit</p>
              </>
            ) : hoveredAreaInfo ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-[#dce9d4]/85">
                  Area Hover
                </p>
                <p className="mt-1 font-semibold text-[#f6fbf3]">
                  {hoveredAreaInfo.habitName}
                </p>
                <p className="mt-1">
                  {hoveredAreaInfo.daysCompleted}
                  {' '}
                  days completed
                </p>
                <p>{hoveredAreaInfo.treeCount} trees in this area</p>
              </>
            ) : (
              <>  </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
