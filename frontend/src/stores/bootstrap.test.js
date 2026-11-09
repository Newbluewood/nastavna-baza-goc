import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/api', () => ({
  BASE_URL: 'http://api.test',
}))

import { useBootstrapStore } from './bootstrap'

describe('bootstrap store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('becomes ready when /api/health returns ok+db', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, db: true }),
    })))

    const store = useBootstrapStore()
    await store.start()
    expect(store.isReady).toBe(true)
    expect(store.isBlocked).toBe(false)
  })

  it('unblocks on /api/test when /api/health returns 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/api/health')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ ok: false, db: false, error: 'Database timeout' }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: 'Test successful' }),
      }
    }))

    const store = useBootstrapStore()
    await store.start()
    expect(store.isReady).toBe(true)
  })

  it('fail-opens after MAX_WAIT_MS when checks keep failing', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network')
    }))

    const store = useBootstrapStore()
    const startPromise = store.start()
    await vi.advanceTimersByTimeAsync(store.MAX_WAIT_MS + 20_000)
    await startPromise

    expect(store.isReady).toBe(true)
    expect(store.isBlocked).toBe(false)
  }, 10_000)
})
