// Web Audio API Procedural Audio for Forestly
// 100% on-device, zero network latency, zero asset size

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        audioCtx = new AudioCtx()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

export function isAudioMuted() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('forestly_audio_muted') === 'true'
}

export function setAudioMuted(muted) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('forestly_audio_muted', muted ? 'true' : 'false')
}

/**
 * Classic crisp coin ding (B5 -> E6)
 * Instant dopamine arcade gold coin pickup sound.
 */
export function playCoinSound() {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  try {
    // Note 1: B5 (987.77 Hz) - short pickup blip
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(987.77, now)

    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.linearRampToValueAtTime(0.22, now + 0.008)
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.075)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.08)

    // Note 2: E6 (1318.51 Hz) - high bell ding with sustained resonant ring
    const note2Start = now + 0.075
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1318.51, note2Start)

    gain2.gain.setValueAtTime(0.001, note2Start)
    gain2.gain.linearRampToValueAtTime(0.28, note2Start + 0.01)
    gain2.gain.exponentialRampToValueAtTime(0.0001, note2Start + 0.42)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(note2Start)
    osc2.stop(note2Start + 0.45)

    // Sparkle harmonic overtone: E7 (2637 Hz) - golden metallic sheen
    const oscHarmonic = ctx.createOscillator()
    const gainHarmonic = ctx.createGain()
    oscHarmonic.type = 'triangle'
    oscHarmonic.frequency.setValueAtTime(2637.02, note2Start)

    gainHarmonic.gain.setValueAtTime(0.001, note2Start)
    gainHarmonic.gain.linearRampToValueAtTime(0.06, note2Start + 0.008)
    gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, note2Start + 0.18)

    oscHarmonic.connect(gainHarmonic)
    gainHarmonic.connect(ctx.destination)
    oscHarmonic.start(note2Start)
    oscHarmonic.stop(note2Start + 0.2)
  } catch {}
}

/**
 * Alias for tree planting completion sound
 */
export const playPlantTreeChime = playCoinSound

/**
 * Subtle organic pop for undoing / unchecking
 */
export function playUncompleteSound() {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.12)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.15)
  } catch {}
}
