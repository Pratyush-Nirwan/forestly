// ── shopThumbnailCache.js ──────────────────────────────────────────────────
// In-memory and sessionStorage cache for pre-rendered 3D shop item snapshots.
// Pre-rendering them at start guarantees 0ms modal open times and eliminates
// browser WebGL context exhaustion (18 separate Canvases crashing WebGL).

const memoryCache = new Map()
const STORAGE_PREFIX = 'forestly_thumb_v1_'

export const shopThumbnailCache = {
  get(itemId) {
    if (!itemId) return null
    if (memoryCache.has(itemId)) {
      return memoryCache.get(itemId)
    }
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem(STORAGE_PREFIX + itemId)
        if (stored) {
          memoryCache.set(itemId, stored)
          return stored
        }
      }
    } catch {
      // Ignore sessionStorage errors (e.g. sandboxed iframe or private mode)
    }
    return null
  },

  set(itemId, dataUrl) {
    if (!itemId || !dataUrl) return
    memoryCache.set(itemId, dataUrl)
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(STORAGE_PREFIX + itemId, dataUrl)
      }
    } catch {
      // Storage quota reached or denied; memoryCache still holds it safely
    }
  },

  has(itemId) {
    return !!this.get(itemId)
  },

  isComplete(itemIds) {
    if (!itemIds || itemIds.length === 0) return false
    return itemIds.every(id => this.has(id))
  },

  getCount(itemIds) {
    if (!itemIds) return 0
    return itemIds.filter(id => this.has(id)).length
  },

  clear() {
    memoryCache.clear()
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith(STORAGE_PREFIX)) {
            sessionStorage.removeItem(key)
          }
        })
      }
    } catch {
      // Ignore
    }
  }
}

export default shopThumbnailCache
