import {
  Suspense,
  lazy,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import OnboardingFlow, { ONBOARDING_KEY, USER_NAME_KEY } from './components/OnboardingFlow'
import TutorialTooltips, { TUTORIAL_KEY } from './components/TutorialTooltips'
import HabitPanel from './components/HabitPanel'
import {
  completeHabitForToday,
  createHabitRecord,
  DEFAULT_TERRAIN_SETTINGS,
  deleteHabit,
  uncompleteHabitForToday,
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
  loadPoints,
  savePoints,
  loadInventory,
  saveInventory,
} from './lib/forest'
import ShopModal, { SHOP_ITEMS } from './components/ShopModal'


// ── Grove info panel ─────────────────────────────────────────────────────────
// Owns its own state so App.jsx never re-renders on area hover.
// The parent registers a setter into `setterRef` without storing state itself.
function GroveInfoPanel({ setterRef, hidden }) {
  const [info, setInfo] = useState(null)
  // Register the setter — stable ref, safe to assign during render
  setterRef.current = setInfo

  if (!info || hidden) return null
  return (
    <div className="pointer-events-none absolute bottom-20 left-3 right-3 z-30 md:bottom-6 md:left-auto md:right-6 md:w-72">
      <div className="forest-panel pointer-events-auto rounded-[24px] px-5 py-4 text-[#eef8ea]">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4e4cc]/60">
          Grove Overview
        </p>
        <p className="mt-2 text-base font-bold text-white">{info.habitName}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Days</p>
            <p className="mt-1 text-lg font-bold text-white">{info.daysCompleted}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-[#d4e4cc]/50">Trees</p>
            <p className="mt-1 text-lg font-bold text-white">{info.treeCount}</p>
          </div>
        </div>
        <p className="mt-2.5 text-xs text-[#d4e4cc]/50">Click the area to zoom in</p>
      </div>
    </div>
  )
}

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
  const areaInfoSetterRef = useRef(null)
  const [terrainSettings, setTerrainSettings] = useState(loadTerrainSettings)
  const [points, setPoints] = useState(() => (isDemo ? 999999 : loadPoints()))
  const [inventory, setInventory] = useState(loadInventory)
  const [placementItem, setPlacementItem] = useState(null)
  const [isShopOpen, setIsShopOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const deferredHabits = useDeferredValue(habits)
  const pendingFocusRef = useRef(null)
  const todayStamp = getTodayStamp()
  const forestTotals = getForestTotals(habits)
  const sceneDateLabel = getSceneDateLabel()
  const userName = localStorage.getItem(USER_NAME_KEY) || ''

  // ── Onboarding / tutorial gates ───────────────────────────────────────────
  const [showNewOnboarding, setShowNewOnboarding] = useState(() =>
    !isDemo && !localStorage.getItem(ONBOARDING_KEY)
  )
  const [showTutorial, setShowTutorial] = useState(false)

  const handleOnboardingComplete = useCallback(({ habitNames }) => {
    // Add the habits but do NOT complete them — user ticks them manually
    startTransition(() => {
      setHabits(currentHabits => {
        let next = currentHabits
        for (const name of habitNames) {
          const result = createHabitRecord(name, next)
          next = result.nextHabits
        }
        return next
      })
    })
    setShowNewOnboarding(false)
    // Show tutorial after the scene has had a moment to mount
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setTimeout(() => setShowTutorial(true), 800)
    }
  }, [startTransition])

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
    savePoints(points)
  }, [points])

  useEffect(() => {
    saveInventory(inventory)
  }, [inventory])

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

        if (result.pointsEarned > 0) {
          setPoints(p => p + result.pointsEarned)
        }

        return result.nextHabits
      })
    })
  }

  function handleUncompleteHabit(habitId) {
    startTransition(() => {
      setHabits(current => {
        const result = uncompleteHabitForToday(habitId, current)
        if (result.pointsRemoved > 0) {
          setPoints(p => Math.max(0, p - result.pointsRemoved))
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

  function handleBuyItem(item) {
    if (points >= item.cost) {
      setPlacementItem(item.id)
      setIsShopOpen(false)
    }
  }

  function handlePlaceItem(itemId, x, z, rotation) {
    const itemConfig = SHOP_ITEMS?.find(i => i.id === itemId)
    if (!itemConfig) return
    
    // Prevent placement if points dropped below cost while in placement mode
    if (points < itemConfig.cost) {
      setPlacementItem(null)
      return
    }
    
    setPoints(p => p - itemConfig.cost)
    setInventory(inv => [...inv, { id: Date.now().toString(), type: itemId, x, z, rotation: rotation || 0 }])
    setPlacementItem(null)
  }

  function handleRemoveItem(item) {
    const itemConfig = SHOP_ITEMS?.find(i => i.id === item.type)
    if (itemConfig) {
      setPoints(p => p + itemConfig.cost)
    }
    setInventory(inv => inv.filter(i => i.id !== item.id))
  }

  // To allow importing SHOP_ITEMS here, I need to make sure SHOP_ITEMS is exported from ShopModal
  // Or I can just deduct points in handleBuyItem, which might be simpler, but if they cancel placement they lose points.
  // Actually, I can just deduct points during handlePlaceItem. But wait, I need the cost!
  // It's cleaner to deduct points during handleBuyItem, but if I want to let them cancel, I should store it.
  // Let's just deduct it when they actually place it.


  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && placementItem) {
        setPlacementItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [placementItem])

  return (
    <main className="relative h-screen overflow-hidden bg-[#b0c5b2] text-white">
      {/* ── Placement Mode Overlay ── */}
      {placementItem && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-[#16271c]/90 backdrop-blur-md px-6 py-3 rounded-full border border-[#a8d878]/30 shadow-2xl flex items-center gap-3">
            <span className="text-xl">🏕️</span>
            <div>
              <p className="text-sm font-bold text-[#eef8ea]">Placement Mode</p>
              <p className="text-xs text-[#a8d878]/80">Click anywhere to place • Press ESC to cancel</p>
            </div>
          </div>
        </div>
      )}

      {/* ── New first-visit onboarding ── */}
      {showNewOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* ── Spotlight tutorial (after onboarding) ── */}
      {showTutorial && (
        <TutorialTooltips onDone={() => setShowTutorial(false)} />
      )}

      <Suspense fallback={<div className="fixed inset-0 bg-[#a9c3ad]" />}>
        <ForestScene
          habits={deferredHabits}
          focusTarget={focusTarget}
          timeOfDay={timeOfDay}
          viewMode={viewMode}
          terrainSettings={terrainSettings}
          selectedTreeId={selectedTreeInfo?.treeId ?? null}
          onTreeSelect={setSelectedTreeInfo}
          onAreaHover={(area) => areaInfoSetterRef.current?.(area)}
          globalSeed={globalSeed}
          inventory={inventory}
          placementItem={placementItem}
          onPlaceItem={handlePlaceItem}
          onRemoveItem={handleRemoveItem}
        />
      </Suspense>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_42%),linear-gradient(180deg,rgba(15,34,24,0.1),rgba(17,31,22,0.38))]" />

      {/* ── Top-right info pill: greeting + date + tree count ── */}
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div className="forest-panel pointer-events-auto rounded-[22px] px-4 py-2.5 text-right text-[#eef8ea]/90 flex items-center gap-4">
          <div>
            {userName && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8d878]/80 mb-0.5">
                Hi, {userName} 👋
              </p>
            )}
            <p className="text-sm font-medium text-white">{sceneDateLabel}</p>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#d4e4cc]/75">
              {forestTotals.treeCount} {forestTotals.treeCount === 1 ? 'tree' : 'trees'} growing • <span className="text-[#a8d878] font-bold">{points} pts</span>
            </p>
          </div>
          <button
            onClick={() => setIsShopOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 active:scale-95"
            title="Open Shop"
          >
            🏪
          </button>
        </div>
      </div>


      <div className="pointer-events-none absolute inset-0 z-20">
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
          onUncompleteHabit={handleUncompleteHabit}
          onSetTimeOfDay={setTimeOfDay}
          onSetViewMode={setViewMode}
          onDeleteHabit={handleDeleteHabit}
          globalSeed={globalSeed}
          onSetGlobalSeed={handleSetGlobalSeed}
          terrainSettings={terrainSettings}
          onSetTerrainSettings={setTerrainSettings}
        />

        {/* ── Bottom info panel ── */}
        {selectedTreeInfo && (
          <div className="pointer-events-none absolute bottom-20 left-3 right-3 z-30 md:bottom-6 md:left-auto md:right-6 md:w-72">
            <div className="forest-panel pointer-events-auto rounded-[24px] px-5 py-4 text-[#eef8ea]">
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
            </div>
          </div>
        )}
        <GroveInfoPanel setterRef={areaInfoSetterRef} hidden={!!selectedTreeInfo} />
      </div>

      <ShopModal 
        isOpen={isShopOpen} 
        onClose={() => setIsShopOpen(false)} 
        points={points} 
        inventory={inventory} 
        onBuy={handleBuyItem} 
      />

    </main>
  )
}

export default App
