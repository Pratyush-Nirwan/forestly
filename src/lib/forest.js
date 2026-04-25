const STORAGE_KEY = 'habit-forest-v1'
const SETTINGS_KEY = 'habit-forest-settings-v1'
const TERRAIN_SETTINGS_KEY = 'habit-forest-terrain-v1'
const STORAGE_VERSION = 1
const TAU = Math.PI * 2
const EDGE_PADDING = 4
const BASE_TREE_SPACING = 2.75
const CANOPY_TYPES = ['rounded', 'conifer', 'hybrid']

export const WORLD_RADIUS = 48
export const TERRAIN_PADDING = 10
export const TERRAIN_SEGMENTS = 180

export const DEFAULT_TERRAIN_SETTINGS = {
  amplitude: 0.65,
  lowFrequency: 1,
  detailFrequency: 1,
  edgeSoftness: 1,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function getTerrainHeight(x, z, terrainSettings = DEFAULT_TERRAIN_SETTINGS) {
  const {
    amplitude = DEFAULT_TERRAIN_SETTINGS.amplitude,
    lowFrequency = DEFAULT_TERRAIN_SETTINGS.lowFrequency,
    detailFrequency = DEFAULT_TERRAIN_SETTINGS.detailFrequency,
    edgeSoftness = DEFAULT_TERRAIN_SETTINGS.edgeSoftness,
  } = terrainSettings
  const radialDistance = Math.hypot(x, z)
  const edgeFalloff = Math.max(
    0,
    1 - radialDistance / (WORLD_RADIUS + 10 + edgeSoftness * 10),
  )
  const broadWave =
    Math.sin(x * 0.06 * lowFrequency) * 1.15 +
    Math.cos(z * 0.05 * lowFrequency) * 0.95
  const midWave = Math.sin((x + z) * 0.11 * detailFrequency) * 0.42
  const crossWave =
    Math.cos(
      (x * 0.08 * detailFrequency - z * 0.07 * detailFrequency) +
        Math.sin((x + z) * 0.02 * detailFrequency),
    ) * 0.35

  return round((broadWave + midWave + crossWave) * edgeFalloff * amplitude)
}

export function sampleTerrainMeshHeight(
  x,
  z,
  terrainSettings = DEFAULT_TERRAIN_SETTINGS,
) {
  const size = (WORLD_RADIUS + TERRAIN_PADDING) * 2
  const half = size / 2
  const step = size / TERRAIN_SEGMENTS

  const u = clamp((x + half) / size, 0, 1)
  const v = clamp((z + half) / size, 0, 1)
  const gridX = u * TERRAIN_SEGMENTS
  const gridZ = v * TERRAIN_SEGMENTS

  const cellX = Math.min(Math.floor(gridX), TERRAIN_SEGMENTS - 1)
  const cellZ = Math.min(Math.floor(gridZ), TERRAIN_SEGMENTS - 1)

  const fx = gridX - cellX
  const fz = gridZ - cellZ

  const x0 = -half + cellX * step
  const x1 = x0 + step
  const z0 = -half + cellZ * step
  const z1 = z0 + step

  const h00 = getTerrainHeight(x0, z0, terrainSettings)
  const h10 = getTerrainHeight(x1, z0, terrainSettings)
  const h01 = getTerrainHeight(x0, z1, terrainSettings)
  const h11 = getTerrainHeight(x1, z1, terrainSettings)

  if (fx + fz <= 1) {
    return round(h00 + (h10 - h00) * fx + (h01 - h00) * fz)
  }

  return round(
    h11 +
      (h01 - h11) * (1 - fx) +
      (h10 - h11) * (1 - fz),
  )
}

function round(value) {
  return Number(value.toFixed(2))
}

function createId(prefix = 'habit') {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function hashSeed(seedText) {
  let hash = 2166136261

  for (const char of seedText) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seedText) {
  let seed = hashSeed(seedText) || 1

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function toHsl(hue, saturation, lightness) {
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`
}

function keepInsideForest(position) {
  const length = Math.hypot(position.x, position.z)

  if (length <= WORLD_RADIUS - EDGE_PADDING) {
    return position
  }

  const safeRadius = WORLD_RADIUS - EDGE_PADDING
  const scale = safeRadius / (length || 1)

  return {
    x: round(position.x * scale),
    z: round(position.z * scale),
  }
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function isPositionClear(candidate, allTrees, spacing) {
  if (Math.hypot(candidate.x, candidate.z) > WORLD_RADIUS - EDGE_PADDING) {
    return false
  }

  return allTrees.every((tree) => distanceBetween(candidate, tree) >= spacing)
}

function flattenTreePositions(habits) {
  return habits.flatMap((habit) =>
    habit.trees.map((tree) => ({
      x: Number(tree.x) || 0,
      z: Number(tree.z) || 0,
    })),
  )
}

export function getTodayStamp(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function createSpecies(seedText) {
  const random = createSeededRandom(`${seedText}:species`)
  const leafHue = 70 + random() * 90
  const leafSaturation = 35 + random() * 45
  const leafLightness = 25 + random() * 35
  const barkHue = 5 + random() * 40
  const barkSaturation = 15 + random() * 35
  const barkLightness = 15 + random() * 45

  return {
    leafColor: toHsl(leafHue, leafSaturation, leafLightness),
    leafAccentColor: toHsl(
      leafHue + 4 - random() * 10,
      leafSaturation + 4,
      leafLightness + 10,
    ),
    barkColor: toHsl(barkHue, barkSaturation, barkLightness),
    trunkHeight: round(1.7 + random() * 2.1),
    trunkThickness: round(0.2 + random() * 0.17),
    leafSize: round(0.55 + random() * 0.7),
    leafDensity: 4 + Math.floor(random() * 4),
    crownLift: round(0.76 + random() * 0.16),
    canopyHeight: round(1.7 + random() * 1.2),
    canopyWidth: round(1.3 + random() * 1.2),
    swaySpeed: round(0.55 + random() * 0.45),
    swayAmount: round(0.02 + random() * 0.045),
    clusterSpread: round(2.4 + random() * 1.4),
    canopyType: CANOPY_TYPES[Math.floor(random() * CANOPY_TYPES.length)],
    signature: round(random() * 1000),
  }
}

function createTree(seedText, position, plantedAt = Date.now()) {
  const random = createSeededRandom(`${seedText}:tree`)

  return {
    id: createId('tree'),
    x: round(position.x),
    z: round(position.z),
    plantedAt,
    rotation: round(random() * TAU),
    scale: round(0.85 + random() * 0.35),
    heightScale: round(0.7 + random() * 0.6),
    trunkScale: round(0.8 + random() * 0.4),
    crownScale: round(0.9 + random() * 0.2),
    crownOffsetX: round((random() - 0.5) * 0.2),
    crownOffsetZ: round((random() - 0.5) * 0.2),
    leanX: round((random() - 0.5) * 0.08),
    leanZ: round((random() - 0.5) * 0.08),
    phase: round(random() * TAU),
    accentMix: round(0.25 + random() * 0.5),
  }
}

function createFirstTreePosition(seedText, allTrees, spacing) {
  const random = createSeededRandom(`${seedText}:first`)

  for (let attempt = 0; attempt < 56; attempt += 1) {
    const angle = random() * TAU
    const radius = Math.sqrt(random()) * (WORLD_RADIUS - EDGE_PADDING - 4)
    const candidate = {
      x: round(Math.cos(angle) * radius),
      z: round(Math.sin(angle) * radius),
    }

    if (isPositionClear(candidate, allTrees, spacing)) {
      return candidate
    }
  }

  return { x: 0, z: 0 }
}

function createNextTreePosition(habit, allTrees) {
  const random = createSeededRandom(`${habit.id}:growth:${habit.trees.length}`)
  const spacing = Math.max(
    BASE_TREE_SPACING,
    habit.species.trunkThickness * 4 + habit.species.leafSize,
  )

  let centerX = 0
  let centerZ = 0
  for (const t of habit.trees) {
    centerX += t.x
    centerZ += t.z
  }
  centerX /= Math.max(1, habit.trees.length)
  centerZ /= Math.max(1, habit.trees.length)

  const baseTreeIndex = Math.floor(random() * habit.trees.length)
  const baseTree = habit.trees[baseTreeIndex] || { x: 0, z: 0 }

  const dx = baseTree.x - centerX
  const dz = baseTree.z - centerZ
  const baseAngle = (dx === 0 && dz === 0) ? random() * TAU : Math.atan2(dz, dx)

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const distance =
      habit.species.clusterSpread * (0.35 + random() * 0.6) + attempt * 0.08
    
    const spread = Math.PI * 0.6 + attempt * 0.15 
    const angle = baseAngle + (random() - 0.5) * spread
    
    const candidate = keepInsideForest({
      x: baseTree.x + Math.cos(angle) * distance,
      z: baseTree.z + Math.sin(angle) * distance,
    })

    if (isPositionClear(candidate, allTrees, spacing)) {
      return candidate
    }
  }

  const fallbackAngle = random() * TAU
  return keepInsideForest({
    x: baseTree.x + Math.cos(fallbackAngle) * (habit.species.clusterSpread + 2),
    z: baseTree.z + Math.sin(fallbackAngle) * (habit.species.clusterSpread + 2),
  })
}

function normalizeTree(tree, habitId, index) {
  const fallback = createTree(`${habitId}:legacy:${index}`, tree, tree.plantedAt ?? 0)

  return {
    ...fallback,
    ...tree,
    id: tree.id ?? fallback.id,
    x: round(Number(tree.x) || 0),
    z: round(Number(tree.z) || 0),
    plantedAt: tree.plantedAt ?? 0,
    rotation: tree.rotation ?? fallback.rotation,
    scale: tree.scale ?? fallback.scale,
    heightScale: tree.heightScale ?? fallback.heightScale,
    trunkScale: tree.trunkScale ?? fallback.trunkScale,
    crownScale: tree.crownScale ?? fallback.crownScale,
    crownOffsetX: tree.crownOffsetX ?? fallback.crownOffsetX,
    crownOffsetZ: tree.crownOffsetZ ?? fallback.crownOffsetZ,
    leanX: tree.leanX ?? fallback.leanX,
    leanZ: tree.leanZ ?? fallback.leanZ,
    phase: tree.phase ?? fallback.phase,
    accentMix: tree.accentMix ?? fallback.accentMix,
  }
}

function normalizeHabit(habit) {
  const species = {
    ...createSpecies(habit.id),
    ...habit.species,
  }
  const trees = Array.isArray(habit.trees)
    ? habit.trees.map((tree, index) => normalizeTree(tree, habit.id, index))
    : []
  const lastTree = trees.at(-1) ?? { x: 0, z: 0 }

  return {
    id: habit.id ?? createId(),
    name: habit.name ?? 'Untitled Habit',
    species,
    trees,
    lastPosition: habit.lastPosition ?? { x: lastTree.x, z: lastTree.z },
    lastCompletedOn: habit.lastCompletedOn ?? null,
    createdAt: habit.createdAt ?? 0,
  }
}

export function loadHabits() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsed = JSON.parse(rawValue)

    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed?.habits)) {
      return []
    }

    return parsed.habits.map(normalizeHabit)
  } catch {
    return []
  }
}

export function saveHabits(habits) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STORAGE_VERSION,
      habits,
    }),
  )
}

export function loadSceneSetting() {
  if (typeof window === 'undefined') {
    return 'dawn'
  }

  const value = window.localStorage.getItem(SETTINGS_KEY)

  if (value === 'day' || value === 'dusk' || value === 'dawn') {
    return value
  }

  return 'dawn'
}

export function saveSceneSetting(value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SETTINGS_KEY, value)
}

export function loadTerrainSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_TERRAIN_SETTINGS }
  }

  try {
    const rawValue = window.localStorage.getItem(TERRAIN_SETTINGS_KEY)

    if (!rawValue) {
      return { ...DEFAULT_TERRAIN_SETTINGS }
    }

    const parsed = JSON.parse(rawValue)

    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_TERRAIN_SETTINGS }
    }

    return {
      amplitude: Number.isFinite(parsed.amplitude)
        ? parsed.amplitude
        : DEFAULT_TERRAIN_SETTINGS.amplitude,
      lowFrequency: Number.isFinite(parsed.lowFrequency)
        ? parsed.lowFrequency
        : DEFAULT_TERRAIN_SETTINGS.lowFrequency,
      detailFrequency: Number.isFinite(parsed.detailFrequency)
        ? parsed.detailFrequency
        : DEFAULT_TERRAIN_SETTINGS.detailFrequency,
      edgeSoftness: Number.isFinite(parsed.edgeSoftness)
        ? parsed.edgeSoftness
        : DEFAULT_TERRAIN_SETTINGS.edgeSoftness,
    }
  } catch {
    return { ...DEFAULT_TERRAIN_SETTINGS }
  }
}

export function saveTerrainSettings(value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(TERRAIN_SETTINGS_KEY, JSON.stringify(value))
}

export function createHabitRecord(name, currentHabits) {
  const trimmedName = name.trim()
  const id = createId()
  const species = createSpecies(id)
  const allTrees = flattenTreePositions(currentHabits)
  const spacing = Math.max(
    BASE_TREE_SPACING,
    species.trunkThickness * 4 + species.leafSize,
  )
  const firstPosition = createFirstTreePosition(id, allTrees, spacing)
  const firstTree = createTree(`${id}:0`, firstPosition)

  return {
    nextHabits: [
      ...currentHabits,
      {
        id,
        name: trimmedName,
        species,
        trees: [firstTree],
        lastPosition: { x: firstTree.x, z: firstTree.z },
        lastCompletedOn: null,
        createdAt: Date.now(),
      },
    ],
    plantedTree: firstTree,
  }
}

export function completeHabitForToday(habitId, currentHabits) {
  const today = getTodayStamp()
  const allTrees = flattenTreePositions(currentHabits)
  let plantedTree = null

  const nextHabits = currentHabits.map((habit) => {
    if (habit.id !== habitId || habit.lastCompletedOn === today) {
      return habit
    }

    const nextPosition = createNextTreePosition(habit, allTrees)
    const nextTree = createTree(`${habit.id}:${habit.trees.length}`, nextPosition)

    allTrees.push({ x: nextTree.x, z: nextTree.z })
    plantedTree = nextTree

    return {
      ...habit,
      trees: [...habit.trees, nextTree],
      lastPosition: { x: nextTree.x, z: nextTree.z },
      lastCompletedOn: today,
    }
  })

  return {
    nextHabits,
    plantedTree,
  }
}

export function getForestTotals(habits) {
  return habits.reduce(
    (totals, habit) => {
      totals.treeCount += habit.trees.length
      return totals
    },
    {
      treeCount: 0,
      habitCount: habits.length,
    },
  )
}

export function getSceneDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function createDemoHabits() {
  const habits = []
  const demoData = [
    { name: 'Morning Jog', count: 32 },
    { name: 'Read 20 Pages', count: 18 },
    { name: 'Drink Water', count: 45 },
    { name: 'Meditate', count: 12 },
    { name: 'Learn Spanish', count: 24 },
    { name: 'Write Journal', count: 8 },
  ]
  
  let allTrees = []

  for (const [index, data] of demoData.entries()) {
    const id = `demo-habit-${index}`
    const species = createSpecies(id)
    const spacing = Math.max(BASE_TREE_SPACING, species.trunkThickness * 4 + species.leafSize)
    const firstPosition = createFirstTreePosition(id, allTrees, spacing)
    
    const trees = []
    trees.push(createTree(`${id}:0`, firstPosition))
    allTrees.push({ x: firstPosition.x, z: firstPosition.z })
    
    const habit = {
      id,
      name: data.name,
      species,
      trees,
      lastPosition: { x: firstPosition.x, z: firstPosition.z },
      lastCompletedOn: getTodayStamp(),
      createdAt: Date.now() - data.count * 86400000,
    }

    for (let i = 1; i < data.count; i++) {
      const nextPosition = createNextTreePosition(habit, allTrees)
      const nextTree = createTree(`${id}:${i}`, nextPosition)
      habit.trees.push(nextTree)
      allTrees.push({ x: nextTree.x, z: nextTree.z })
      habit.lastPosition = { x: nextTree.x, z: nextTree.z }
    }
    
    habits.push(habit)
  }
  
  return habits
}
