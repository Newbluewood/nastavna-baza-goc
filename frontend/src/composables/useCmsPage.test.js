import { describe, expect, test, vi } from 'vitest'

vi.mock('../services/api', () => ({
  default: {},
  BASE_URL: 'http://127.0.0.1:3000',
}))

vi.mock('../stores/lang', () => ({
  useLangStore: () => ({ currentLang: 'sr' }),
}))

describe('buildHeroSlide', () => {
  test('uses page title and resolved hero image', async () => {
    const { buildHeroSlide } = await import('./useCmsPage')
    expect(buildHeroSlide({
      title: 'Vesti',
      hero_image: '/uploads/hero.jpg',
    })).toEqual([{
      image_url: 'http://127.0.0.1:3000/uploads/hero.jpg',
      title: 'Vesti',
    }])
  })

  test('falls back to title and placeholder', async () => {
    const { buildHeroSlide } = await import('./useCmsPage')
    expect(buildHeroSlide(null, 'Fallback')).toEqual([{
      image_url: '/placeholder.jpg',
      title: 'Fallback',
    }])
  })
})
