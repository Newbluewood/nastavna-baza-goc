import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BASE_URL } from '../services/api'

const MAX_WAIT_MS = 60_000
const RETRY_MS = 2_000

export const useBootstrapStore = defineStore('bootstrap', () => {
  const status = ref('loading') // loading | ready | timeout
  const elapsedSec = ref(0)
  const lastError = ref('')
  let timer = null
  let startedAt = 0

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

  const checkHealth = async () => {
    const controller = new AbortController()
    const kill = setTimeout(() => controller.abort(), 12_000)
    try {
      const { res, data } = await fetchJson('/api/health', controller.signal)
      if (res.ok && data?.ok && data?.db) {
        lastError.value = ''
        return true
      }

      // Older API without /health: treat settings load as DB readiness.
      if (res.status === 404) {
        const fallback = await fetchJson('/api/settings?lang=sr', controller.signal)
        if (fallback.res.ok && fallback.data && typeof fallback.data === 'object') {
          lastError.value = ''
          return true
        }
        lastError.value = fallback.data?.error || `HTTP ${fallback.res.status}`
        return false
      }

      lastError.value = data?.error || `HTTP ${res.status}`
      return false
    } catch (err) {
      lastError.value = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network')
      return false
    } finally {
      clearTimeout(kill)
    }
  }

  const finishReady = () => {
    status.value = 'ready'
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const finishTimeout = () => {
    status.value = 'timeout'
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const start = async () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    status.value = 'loading'
    lastError.value = ''
    startedAt = Date.now()
    elapsedSec.value = 0

    const tick = async () => {
      elapsedSec.value = Math.min(60, Math.floor((Date.now() - startedAt) / 1000))
      const ok = await checkHealth()
      if (ok) {
        finishReady()
        return
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        finishTimeout()
      }
    }

    await tick()
    if (status.value === 'loading') {
      timer = setInterval(tick, RETRY_MS)
    }
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
