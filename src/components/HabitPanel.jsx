import { useState } from 'react'

const TIME_OPTIONS = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'day', label: 'Day' },
  { id: 'dusk', label: 'Dusk' },
]

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
}) {
  const [draftHabit, setDraftHabit] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedName = draftHabit.trim()

    if (!trimmedName) {
      return
    }

    onAddHabit(trimmedName)
    setDraftHabit('')
  }

  return (
    <aside className="forest-panel pointer-events-auto fixed flex h-[94vh] w-full max-w-sm flex-col overflow-hidden rounded-[28px] p-5 text-[#edf6ea] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d4e4cc]/85">
            Habit Forest
          </p>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-right text-xs text-[#eff8ea]/80">
          <p>{sceneDateLabel}</p>
          <p className="mt-1 text-[0.7rem] uppercase tracking-[0.24em]">
            {forestTotals.treeCount} trees
          </p>
        </div>
      </div>



      <form className="mt-5 flex gap-3" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draftHabit}
          onChange={(event) => setDraftHabit(event.target.value)}
          placeholder="Add a habit to plant a new species"
          className="forest-input min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm text-white placeholder:text-[#d8e7d2]/55"
        />
        <button
          type="submit"
          disabled={isPending || !draftHabit.trim()}
          className="rounded-2xl bg-[#cde0af] px-4 py-3 text-sm font-semibold text-[#284024] transition hover:bg-[#d9eabf] disabled:cursor-not-allowed disabled:opacity-55"
        >
          Add Habit
        </button>
      </form>

      <div className="mt-5 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#d4e4cc]/65">
            Species
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {forestTotals.habitCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[#d4e4cc]/65">
            Today
          </p>
          <p className="mt-2 text-sm leading-6 text-[#f6fbf4]">
            {habits.filter((habit) => habit.lastCompletedOn === todayStamp).length}
            {' '}
            planted
          </p>
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#d4e4cc]/75">
            Daily Check
          </h2>
          <div className="flex rounded-full border border-white/10 bg-black/10 p-1">
            {TIME_OPTIONS.map((option) => {
              const active = option.id === timeOfDay

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSetTimeOfDay(option.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active
                    ? 'bg-white/18 text-white'
                    : 'text-[#d8e7d2]/70 hover:text-white'
                    }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex rounded-full border border-white/10 bg-black/10 p-1">
          <button
            type="button"
            onClick={() => onSetViewMode('forest')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${viewMode === 'forest'
              ? 'bg-white/18 text-white'
              : 'text-[#d8e7d2]/70 hover:text-white'
              }`}
          >
            Forest View
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('areas')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${viewMode === 'areas'
              ? 'bg-white/18 text-white'
              : 'text-[#d8e7d2]/70 hover:text-white'
              }`}
          >
            Area View
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {habits.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/18 bg-black/10 px-4 py-5 text-sm leading-6 text-[#e3efde]/70">
              Your clearing is quiet for now. Add your first habit and the first
              tree will appear automatically.
            </div>
          ) : null}

          {habits.map((habit) => {
            const completedToday = habit.lastCompletedOn === todayStamp

            return (
              <label
                key={habit.id}
                className="flex cursor-pointer items-start gap-4 rounded-[24px] border border-white/10 bg-black/12 px-4 py-4 transition hover:border-white/18 hover:bg-black/18"
              >
                <input
                  type="checkbox"
                  checked={completedToday}
                  disabled={completedToday || isPending}
                  onChange={() => onCompleteHabit(habit.id)}
                  className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent accent-[#d7ebb9]"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-white">
                        {habit.name}
                      </p>
                      <p className="mt-1 text-sm text-[#dce9d6]/72">
                        {habit.trees.length} trees growing in this cluster
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: habit.species.leafColor }}
                      />
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: habit.species.barkColor }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#d9e8d2]/68">
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      {habit.species.canopyType}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      leaf density {habit.species.leafDensity}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      spread {habit.species.clusterSpread.toFixed(1)}m
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#f3f8ee]">
                    {completedToday
                      ? 'Tree planted for today.'
                      : 'Check off today to grow another tree nearby.'}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default HabitPanel
