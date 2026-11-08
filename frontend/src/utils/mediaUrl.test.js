import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../services/api', () => ({
  BASE_URL: 'http://127.0.0.1:3000',
}))

describe('mediaUrl', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test('passes through absolute http(s) urls', async () => {
    const { resolveMediaUrl } = await import('./mediaUrl')
    expect(resolveMediaUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg')
    expect(resolveMediaUrl('http://cdn.example/a.jpg')).toBe('http://cdn.example/a.jpg')
  })

  test('prefixes relative /uploads paths with API host', async () => {
    const { resolveMediaUrl } = await import('./mediaUrl')
    expect(resolveMediaUrl('/uploads/a.jpg')).toBe('http://127.0.0.1:3000/uploads/a.jpg')
    expect(resolveMediaUrl('uploads/a.jpg')).toBe('http://127.0.0.1:3000/uploads/a.jpg')
  })

  test('empty values become empty or placeholder', async () => {
    const { resolveMediaUrl, resolveMediaUrlOrPlaceholder } = await import('./mediaUrl')
    expect(resolveMediaUrl('')).toBe('')
    expect(resolveMediaUrl(null)).toBe('')
    expect(resolveMediaUrlOrPlaceholder('')).toBe('/placeholder.jpg')
    expect(resolveMediaUrlOrPlaceholder('/uploads/x.jpg')).toBe('http://127.0.0.1:3000/uploads/x.jpg')
  })
})
