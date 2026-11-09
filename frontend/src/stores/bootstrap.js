import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BASE_URL } from '../services/api'

const MAX_WAIT_MS = 45_000
const RETRY_MS = 2_500
const REQUEST_TIMEOUT_MS = 8_000

export const useBootstrapStore = defineStore('bootstrap', () => {
  const status = ref('loading') // loading | ready
  const elapsedSec = ref(0)
  const lastError = ref('')
  let timer = null
  let startedAt = 0
  let inFlight = false
  let generation = 0

  const isReady = computed(() => status.value === 'ready')
  const isBlocked = computed(() => status.value !== 'ready')

  const fetchJson = async (path, signal) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      signal,
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  const withTimeout = async (fn) => {
    const controller = new AbortController()
    const kill = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      return await fn(controller.signal)
    } finally {
      clearTimeout(kill)
    }
  }

  const checkHealth = async () => {
    try {
      const { res, data } = await withTimeout((signal) => fetchJson('/api/health', signal))
      if (res.ok && data?.ok && data?.db) {
        lastError.value = ''
        return true
      }

      // Older API without /health, or health stuck behind DB: any live API response unblocks UI.
      if (res.status === 404 || res.status === 503) {
        const fallback = await withTimeout((signal) => fetchJson('/api/test', signal))
        if (fallback.res.ok) {
          lastError.value = data?.error || `HTTP ${res.status}`
          return true
        }
        lastError.value = fallback.data?.error || `HTTP ${fallback.res.status}`
        return false
      }

      lastError.value = data?.error || `HTTP ${res.status}`
      return false
    } catch (err) {
      // Render accepted TLS but app still silent — try a cheap liveness route once.
      try {
        const fallback = await withTimeout((signal) => fetchJson('/api/test', signal))
        if (fallback.res.ok) {
          lastError.value = err?.name === 'AbortError' ? 'health-timeout' : (err?.message || 'network')
          return true
        }
      } catch {
        // ignore — handled below
      }
      lastError.value = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network')
      return false
    }
  }

  const stopTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const finishReady = () => {
    status.value = 'ready'
    stopTimer()
    inFlight = false
  }

  const start = async () => {
    generation += 1
    const myGen = generation
    stopTimer()
    inFlight = false
    status.value = 'loading'
    lastError.value = ''
    startedAt = Date.now()
    elapsedSec.value = 0

    const tick = async () => {
      if (myGen !== generation || status.value === 'ready') return
      elapsedSec.value = Math.min(60, Math.floor((Date.now() - startedAt) / 1000))

      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        // Fail open: show the site like before the gate existed.
        finishReady()
        return
      }

      if (inFlight) {
        timer = setTimeout(tick, RETRY_MS)
        return
      }

      inFlight = true
      let ok = false
      try {
        ok = await checkHealth()
      } finally {
        inFlight = false
      }

      if (myGen !== generation) return
      if (ok) {
        finishReady()
        return
      }

      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        finishReady()
        return
      }

      timer = setTimeout(tick, RETRY_MS)
    }

    await tick()
  }

  const retry = () => start()

  return {
    status,
    elapsedSec,
    lastError,
    isReady,
    isBlocked,
    start,
    retry,
    MAX_WAIT_MS
  }
})
