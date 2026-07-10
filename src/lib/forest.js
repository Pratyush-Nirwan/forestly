import * as THREE from 'three'

const STORAGE_KEY = 'habit-forest-v1'
const SETTINGS_KEY = 'habit-forest-settings-v1'
const TERRAIN_SETTINGS_KEY = 'habit-forest-terrain-v1'
const GLOBAL_SEED_KEY = 'habit-forest-seed-v1'
const POINTS_KEY = 'habit-forest-points-v1'
const INVENTORY_KEY = 'habit-forest-inventory-v1'
const STORAGE_VERSION = 1
const TAU = Math.PI * 2
const EDGE_PADDING = 4
const BASE_TREE_SPACING = 2.75
const CANOPY_TYPES = ['rounded', 'conifer', 'hybrid']

export const WORLD_RADIUS = 48
export const TERRAIN_PADDING = 10
export const TERRAIN_SEGMENTS = 180
export const GLOBE_RADIUS = 30
export const WATER_LEVEL = -0.3

export function findDryLand(x, z, terrainSettings, globalSeed) {
  let searchRadius = 0.5
  let angle = 0
  
  for (let i = 0; i < 500; i++) {
    angle += 0.8
    searchRadius += 0.15
    const checkX = x + Math.cos(angle) * searchRadius
    const checkZ = z + Math.sin(angle) * searchRadius
    
    if (Math.hypot(checkX, checkZ) > WORLD_RADIUS - 2) continue

    const height = getTerrainHeight(checkX, checkZ, terrainSettings, globalSeed)
    if (height > WATER_LEVEL + 0.3) {
      return { x: checkX, z: checkZ }
    }
  }
  return { x, z }
}

export function mapToWorld(x, y, z, shape) {
  if (shape === 'plane') {
    return {
      position: [x, y, z],
      quaternion: new THREE.Quaternion(),
    }
  }

  const theta = x / GLOBE_RADIUS
  const phi = -z / GLOBE_RADIUS

  const r = GLOBE_RADIUS + y

  const pX = r * Math.sin(theta) * Math.cos(phi)
  const pY = r * Math.cos(theta) * Math.cos(phi) - GLOBE_RADIUS
  const pZ = r * Math.sin(phi)

  const euler = new THREE.Euler(phi, 0, -theta, 'YXZ')
  const quaternion = new THREE.Quaternion().setFromEuler(euler)

  return { position: [pX, pY, pZ], quaternion }
}

export const DEFAULT_TERRAIN_SETTINGS = {
  amplitude: 1.1,
  lowFrequency: 1,
  detailFrequency: 1,
  edgeSoftness: 1,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// ── Gradient noise infrastructure ────────────────────────────────────────────
const _permCache = new Map()

function _buildPerm(seed) {
  const key = String(seed)
  if (_permCache.has(key)) return _permCache.get(key)

  // FNV-1a hash → seed an LCG
  let s = 2166136261
  for (let i = 0; i < key.length; i++) {
    s ^= key.charCodeAt(i)
    s = Math.imul(s, 16777619)
  }
  s = (s >>> 0) || 1

  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }

  // Fisher-Yates shuffle of [0..255]
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (next() * (i + 1)) | 0
    const t = p[i]; p[i] = p[j]; p[j] = t
  }

  // Duplicate so we never need index wrapping
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  _permCache.set(key, perm)
  return perm
}

// 8 gradient vectors (unit vectors on a circle)
const _GX = new Float32Array([ 1, -1,  0,  0,  1, -1,  1, -1])
const _GY = new Float32Array([ 0,  0,  1, -1,  1, -1, -1,  1])

function _grad(h, x, y) {
  const i = h & 7
  return _GX[i] * x + _GY[i] * y
}

// Quintic fade – smoother than cubic
function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function _lerp(a, b, t) { return a + t * (b - a) }

// Classic 2-D Perlin noise, returns roughly [-1, 1]
function _perlin(perm, x, y) {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = _fade(xf)
  const v = _fade(yf)

  const aa = perm[perm[xi    ] + yi    ]
  const ab = perm[perm[xi    ] + yi + 1]
  const ba = perm[perm[xi + 1] + yi    ]
  const bb = perm[perm[xi + 1] + yi + 1]

  return _lerp(
    _lerp(_grad(aa, xf,     yf    ), _grad(ba, xf - 1, yf    ), u),
    _lerp(_grad(ab, xf,     yf - 1), _grad(bb, xf - 1, yf - 1), u),
    v,
  )
}

// Fractal Brownian Motion – octaves of noise summed at increasing frequencies
function _fbm(perm, x, y, octaves) {
  let val = 0, amp = 0.5, freq = 1, norm = 0
  for (let o = 0; o < octaves; o++) {
    val  += _perlin(perm, x * freq, y * freq) * amp
    norm += amp
    amp  *= 0.5
    freq *= 2.03   // slight lacunarity offset removes grid alignment
  }
  return val / norm  // normalised to roughly [-1, 1]
}
// ─────────────────────────────────────────────────────────────────────────────

export function getTerrainHeight(x, z, terrainSettings = DEFAULT_TERRAIN_SETTINGS, globalSeed = 'forest') {
  const {
    amplitude      = DEFAULT_TERRAIN_SETTINGS.amplitude,
    lowFrequency   = DEFAULT_TERRAIN_SETTINGS.lowFrequency,
    detailFrequency= DEFAULT_TERRAIN_SETTINGS.detailFrequency,
    edgeSoftness   = DEFAULT_TERRAIN_SETTINGS.edgeSoftness,
  } = terrainSettings

  const perm = _buildPerm(globalSeed)

  // Radial edge falloff (same logic as before)
  const radialDistance = Math.hypot(x, z)
  const edgeFalloff = Math.max(
    0,
    1 - radialDistance / (WORLD_RADIUS + 10 + edgeSoftness * 10),
  )

  // ── Domain warp ─────────────────────────────────────────────────────────
  // Displace the lookup coords with another fBm pass so coastlines and
  // ridges get that organic, twisted look instead of smooth blobs.
  const ws = 0.022 * lowFrequency
  const wx = _fbm(perm, x * ws + 31.7, z * ws + 71.3, 3) * 14
  const wz = _fbm(perm, x * ws + 91.1, z * ws + 17.9, 3) * 14
  const sx = x + wx
  const sz = z + wz

  // ── Terrain layers ───────────────────────────────────────────────────────
  // 1. Continent-scale shapes  (slow, large, 3 octaves)
  const continent = _fbm(perm, sx * 0.020 * lowFrequency,          sz * 0.020 * lowFrequency,          3) * 1.6

  // 2. Rolling hills / valleys (medium, 4 octaves)
  const hills     = _fbm(perm, sx * 0.058 * detailFrequency + 100, sz * 0.058 * detailFrequency + 100, 4) * 0.75

  // 3. Surface roughness       (fine,   3 octaves)
  const rough     = _fbm(perm, sx * 0.14  * detailFrequency + 200, sz * 0.14  * detailFrequency + 200, 3) * 0.22

  const combined = continent + hills + rough

  return round(combined * edgeFalloff * amplitude)
}


export function sampleTerrainMeshHeight(
  x,
  z,
  terrainSettings = DEFAULT_TERRAIN_SETTINGS,
  globalSeed = 'forest'
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

  const h00 = getTerrainHeight(x0, z0, terrainSettings, globalSeed)
  const h10 = getTerrainHeight(x1, z0, terrainSettings, globalSeed)
  const h01 = getTerrainHeight(x0, z1, terrainSettings, globalSeed)
  const h11 = getTerrainHeight(x1, z1, terrainSettings, globalSeed)

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
  if (typeof window === 'undefined') return 0.5
  const raw = window.localStorage.getItem(SETTINGS_KEY)
  if (raw === null) return 0.5
  const num = Number(raw)
  if (!isNaN(num) && num >= 0 && num <= 1) return num
  // map legacy string values
  if (raw === 'dawn') return 0
  if (raw === 'day')  return 0.5
  if (raw === 'dusk') return 1
  return 0.5
}

export function saveSceneSetting(value) {
  if (typeof window === 'undefined') return
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

export function loadGlobalSeed() {
  if (typeof window === 'undefined') {
    return 'forest'
  }

  let seed = window.localStorage.getItem(GLOBAL_SEED_KEY)

  if (!seed) {
    seed = Math.random().toString(36).substring(2, 8).toUpperCase()
    window.localStorage.setItem(GLOBAL_SEED_KEY, seed)
  }

  return seed
}

export function saveGlobalSeed(seed) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(GLOBAL_SEED_KEY, seed)
}

export function loadPoints() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(POINTS_KEY)
  return raw ? parseInt(raw, 10) || 0 : 0
}

export function savePoints(points) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(POINTS_KEY, points.toString())
}

export function loadInventory() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(INVENTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveInventory(inventory) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory))
}

export function createHabitRecord(name, currentHabits) {
  const trimmedName = name.trim()
  const id = createId()
  const species = createSpecies(id)

  return {
    nextHabits: [
      ...currentHabits,
      {
        id,
        name: trimmedName,
        species,
        trees: [],          // no tree yet — planted on first check-in
        lastPosition: null,
        lastCompletedOn: null,
        createdAt: Date.now(),
      },
    ],
    plantedTree: null,   // nothing to focus until first check-in
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

    const nextPosition =
      habit.trees.length === 0
        ? createFirstTreePosition(habit.id, allTrees,
            Math.max(BASE_TREE_SPACING,
              habit.species.trunkThickness * 4 + habit.species.leafSize))
        : createNextTreePosition(habit, allTrees)

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

  return { nextHabits, plantedTree, pointsEarned: plantedTree ? 10 : 0 }
}

export function uncompleteHabitForToday(habitId, currentHabits) {
  let pointsRemoved = 0
  const nextHabits = currentHabits.map((habit) => {
    if (habit.id !== habitId) return habit
    const today = getTodayStamp()
    if (habit.lastCompletedOn !== today) return habit

    const lastTree = habit.trees.at(-1)
    if (lastTree && getTodayStamp(new Date(lastTree.plantedAt)) === today) {
      pointsRemoved = 10
      return {
        ...habit,
        trees: habit.trees.slice(0, -1),
        lastCompletedOn: habit.trees.length > 1 
          ? getTodayStamp(new Date(habit.trees[habit.trees.length - 2].plantedAt))
          : null,
        lastPosition: habit.trees.length > 1
          ? { x: habit.trees[habit.trees.length - 2].x, z: habit.trees[habit.trees.length - 2].z }
          : null
      }
    }
    return habit
  })
  return { nextHabits, pointsRemoved }
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

// ── Habit analytics ───────────────────────────────────────────────────────────

const DAY_MS = 86400000

function dayKey(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Consecutive-day streak ending today (or yesterday if not done today) */
export function getHabitStreak(habit) {
  if (!habit.trees.length) return 0
  const done = new Set(habit.trees.map(t => dayKey(t.plantedAt)))
  const todayMs = dayKey(Date.now())
  let ms = done.has(todayMs) ? todayMs : todayMs - DAY_MS
  let streak = 0
  while (done.has(ms) && streak < 9999) { streak++; ms -= DAY_MS }
  return streak
}

/** All-time longest consecutive-day streak */
export function getLongestStreak(habit) {
  if (!habit.trees.length) return 0
  const sorted = [...new Set(habit.trees.map(t => dayKey(t.plantedAt)))].sort((a, b) => a - b)
  let longest = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    cur = sorted[i] - sorted[i - 1] === DAY_MS ? cur + 1 : 1
    if (cur > longest) longest = cur
  }
  return longest
}

/** Array of { ms, completed } for last numDays, oldest first */
export function getCompletionCalendar(habit, numDays = 28) {
  const done = new Set(habit.trees.map(t => dayKey(t.plantedAt)))
  const todayMs = dayKey(Date.now())
  return Array.from({ length: numDays }, (_, i) => {
    const ms = todayMs - (numDays - 1 - i) * DAY_MS
    return { ms, completed: done.has(ms) }
  })
}

/** Completion rate 0-100 over last `days` days */
export function getHabitCompletionRate(habit, days = 30) {
  const cal = getCompletionCalendar(habit, days)
  return Math.round(cal.filter(d => d.completed).length / days * 100)
}

/** Milestone based on total tree count */
export function getMilestone(treeCount) {
  if (treeCount >= 100) return { label: 'Ancient', emoji: '🌳', level: 4 }
  if (treeCount >= 30)  return { label: 'Grove',   emoji: '🌲', level: 3 }
  if (treeCount >= 7)   return { label: 'Sapling', emoji: '🌿', level: 2 }
  return                       { label: 'Seedling', emoji: '🪴', level: 1 }
}

/** True if habit has trees but hasn't been completed in 2+ days */
export function isHabitWithered(habit) {
  if (!habit.trees.length || !habit.lastCompletedOn) return false
  const today     = getTodayStamp()
  const d         = new Date(); d.setDate(d.getDate() - 1)
  const yesterday = getTodayStamp(d)
  return habit.lastCompletedOn !== today && habit.lastCompletedOn !== yesterday
}

/** Remove a habit by id */
export function deleteHabit(habitId, currentHabits) {
  return currentHabits.filter(h => h.id !== habitId)
}

