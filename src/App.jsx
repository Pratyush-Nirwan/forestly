import {
  Suspense,
  lazy,
  useCallback,
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
  deleteHabit,
  uncompleteHabitForToday,
  getForestTotals,
  getSceneDateLabel,
  getTodayStamp,
  loadHabits,
  loadTerrainSettings,
  saveHabits,
  saveTerrainSettings,
  createDemoHabits,
  loadGlobalSeed,
  saveGlobalSeed,
  loadPoints,
  savePoints,
  loadInventory,
  saveInventory,
} from './lib/forest'
import ShopModal, { SHOP_ITEMS } from './components/ShopModal'
import StartLoader from './components/StartLoader'
import ShopPreloadRunner from './components/ShopPreloadRunner'
import NotFoundPage from './components/NotFoundPage'
import LegalModal from './components/LegalModal'
import { isAudioMuted, playPlantTreeChime, playUncompleteSound, setAudioMuted } from './lib/audio'


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

function App() {
  const rawPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') || '/' : '/'
  const isDemo = rawPath === '/demo'
  const isPrivacy = rawPath === '/privacy'
  const isTerms = rawPath === '/terms'
  const isNotFound = rawPath !== '/' && !isDemo && !isPrivacy && !isTerms

  const [legalModalType, setLegalModalType] = useState(() => {
    if (isPrivacy) return 'privacy'
    if (isTerms) return 'terms'
    return null
  })

  const [globalSeed, setGlobalSeed] = useState(loadGlobalSeed)
  const [habits, setHabits] = useState(() => (isDemo ? createDemoHabits() : loadHabits()))
  const [inventory, setInventory] = useState(loadInventory)
  const [points, setPoints] = useState(() => (isDemo ? 9999999 : loadPoints(habits, inventory)))
  const [focusTarget, setFocusTarget] = useState(null)
  const [viewMode, setViewMode] = useState('forest')
  const [selectedTreeInfo, setSelectedTreeInfo] = useState(null)
  const areaInfoSetterRef = useRef(null)
  const [terrainSettings, setTerrainSettings] = useState(loadTerrainSettings)
  const [placementItem, setPlacementItem] = useState(null)
  const [isMuted, setIsMuted] = useState(() => isAudioMuted())
  const [isShopOpen, setIsShopOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pendingFocusRef = useRef(null)
  const todayStamp = getTodayStamp()
  const forestTotals = getForestTotals(habits)
  const sceneDateLabel = getSceneDateLabel()
  const userName = localStorage.getItem(USER_NAME_KEY) || ''

  // ── Onboarding / tutorial gates ───────────────────────────────────────────
  const [showNewOnboarding, setShowNewOnboarding] = useState(() =>
    !isDemo && !localStorage.getItem(ONBOARDING_KEY)
  )
  const [isInitialLoading, setIsInitialLoading] = useState(() => !showNewOnboarding)
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
    if (!isDemo) {
      saveTerrainSettings(terrainSettings)
    }
  }, [terrainSettings, isDemo])

  useEffect(() => {
    if (!isDemo) {
      savePoints(points, habits, inventory)
    }
  }, [points, habits, inventory, isDemo])

  useEffect(() => {
    if (!isDemo) {
      saveInventory(inventory)
    }
  }, [inventory, isDemo])

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
          playPlantTreeChime()
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
          playPlantTreeChime()
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
          playUncompleteSound()
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

  const handleResetProgress = useCallback(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {
      console.warn('Failed to clear storage:', e)
    }
    // Brief delay to allow the confirm state animation to finish smoothly
    setTimeout(() => {
      window.location.href = '/'
    }, 600)
  }, [])


  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && placementItem) {
        setPlacementItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [placementItem])

  if (isNotFound) {
    return <NotFoundPage />
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#5da9ef] text-white">
      {/* ── Placement Mode Overlay ── */}
      {placementItem && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="forest-panel px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <span className="text-xl">🏕️</span>
            <div>
              <p className="text-sm font-bold text-[#eef8ea]">Placement Mode</p>
              <p className="text-xs text-[#a8d878]/80">Click anywhere to place • Press ESC to cancel</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Start Loader for initial startup & preloading ── */}
      {isInitialLoading && !showNewOnboarding && (
        <StartLoader onDone={() => setIsInitialLoading(false)} fullScreen={true} />
      )}

      {/* ── Background preloader while user is in onboarding ── */}
      {showNewOnboarding && (
        <ShopPreloadRunner isRunning={true} />
      )}

      {/* ── New first-visit onboarding ── */}
      {showNewOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* ── Spotlight tutorial (after onboarding) ── */}
      {showTutorial && (
        <TutorialTooltips onDone={() => setShowTutorial(false)} />
      )}

      <Suspense fallback={<StartLoader fullScreen={true} />}>
        <ForestScene
          habits={habits}
          focusTarget={focusTarget}
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

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(17,31,22,0.35)_100%)]" />

      {/* ── Top-right action buttons (Audio chime toggle + Shop) ── */}
      <div className="pointer-events-auto absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => {
            const nextMuted = !isMuted
            setIsMuted(nextMuted)
            setAudioMuted(nextMuted)
            if (!nextMuted) {
              playPlantTreeChime()
            }
          }}
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-md shadow-lg transition-all duration-200 hover:border-white/35 hover:bg-black/40 hover:scale-105 active:scale-95"
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {isMuted ? (
            <svg
              className="w-5 h-5 text-white/50 transition-colors group-hover:text-white/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-[#a8d878] transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setIsShopOpen(true)}
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-md shadow-lg transition-all duration-200 hover:border-white/35 hover:bg-black/40 hover:scale-105 active:scale-95"
          title="Open Shop"
          aria-label="Open Shop"
        >
          <svg
            className="w-5 h-5 text-white transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
          </svg>
        </button>
      </div>

      {/* ── Top info: greeting + tree count + checklist (top-left on mobile, top-right on desktop to the left of shop & sound toggle) ── */}
      <div className="pointer-events-none absolute top-4 left-4 md:left-auto md:right-28 z-10 flex flex-col items-start md:items-end gap-2 max-w-[calc(100vw-7rem)] md:max-w-xs">
        <div className="pointer-events-auto text-left md:text-right drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          {userName && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8d878] mb-0.5">
              Hi, {userName} 👋
            </p>
          )}
          <p className="text-[0.74rem] uppercase tracking-[0.22em] text-white/95 font-bold">
            {forestTotals.treeCount} {forestTotals.treeCount === 1 ? 'tree' : 'trees'} growing • <span className="text-[#a8d878] font-extrabold">{points} pts</span>
          </p>
        </div>

        {/* ── Quick Habit Checklist ── */}
        {habits.length > 0 && (
          <div className="pointer-events-auto flex flex-col items-start md:items-end gap-1.5 mt-1 max-h-[50vh] overflow-y-auto pl-0.5 md:pl-0 md:pr-0.5">
            {habits.map((habit) => {
              const isCompleted = habit.lastCompletedOn === todayStamp
              return (
                <button
                  type="button"
                  key={habit.id}
                  onClick={() => {
                    if (isPending) return
                    if (isCompleted) {
                      handleUncompleteHabit(habit.id)
                    } else {
                      handleCompleteHabit(habit.id)
                    }
                  }}
                  className="group flex items-center gap-2.5 py-1 px-1 cursor-pointer select-none transition-all duration-200 active:scale-[0.98] outline-none focus:outline-none"
                  title={isCompleted ? `Mark ${habit.name} as undone` : `Mark ${habit.name} as done`}
                >
                  {/* Circular tick box */}
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-[#a8d878]'
                        : 'border-2 border-white/80 group-hover:border-white'
                    }`}
                  >
                    {isCompleted && (
                      <svg
                        className="h-2.5 w-2.5 text-[#11240f] stroke-[3]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  {/* Habit name */}
                  <span
                    className={`text-xs font-semibold tracking-wide ${
                      isCompleted ? 'line-through text-white/40' : 'text-white/95 group-hover:text-white'
                    }`}
                  >
                    {habit.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>


      <div className="pointer-events-none absolute inset-0 z-20">
        <HabitPanel
          habits={habits}
          isPending={isPending}
          todayStamp={todayStamp}
          sceneDateLabel={sceneDateLabel}
          forestTotals={forestTotals}
          viewMode={viewMode}
          onAddHabit={handleAddHabit}
          onCompleteHabit={handleCompleteHabit}
          onUncompleteHabit={handleUncompleteHabit}
          onSetViewMode={setViewMode}
          onDeleteHabit={handleDeleteHabit}
          globalSeed={globalSeed}
          onSetGlobalSeed={handleSetGlobalSeed}
          terrainSettings={terrainSettings}
          onSetTerrainSettings={setTerrainSettings}
          onResetProgress={handleResetProgress}
          onOpenLegal={setLegalModalType}
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
        onBuy={handleBuyItem} 
      />

      {legalModalType && (
        <LegalModal
          type={legalModalType}
          onClose={() => {
            setLegalModalType(null)
            if (isPrivacy || isTerms) {
              window.history.pushState(null, '', '/')
            }
          }}
        />
      )}

    </main>
  )
}

export default App
