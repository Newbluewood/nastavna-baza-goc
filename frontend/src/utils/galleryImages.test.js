import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../services/api', () => ({
  BASE_URL: 'http://127.0.0.1:3000',
}))

describe('collectGalleryImages', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test('returns [] for empty item', async () => {
    const { collectGalleryImages } = await import('./galleryImages')
    expect(collectGalleryImages(null)).toEqual([])
    expect(collectGalleryImages({})).toEqual([])
  })

  test('accepts both string and { image_url } gallery entries', async () => {
    const { collectGalleryImages } = await import('./galleryImages')
    expect(
      collectGalleryImages({
        cover_image: '/uploads/cover.jpg',
        gallery: ['/uploads/a.jpg', { image_url: '/uploads/b.jpg' }],
      })
    ).toEqual([
      'http://127.0.0.1:3000/uploads/cover.jpg',
      'http://127.0.0.1:3000/uploads/a.jpg',
      'http://127.0.0.1:3000/uploads/b.jpg',
    ])
  })

  test('skips placeholders and duplicates', async () => {
    const { collectGalleryImages } = await import('./galleryImages')
    expect(
      collectGalleryImages({
        cover_image: '/placeholder.jpg',
        gallery: [
          { image_url: '/uploads/a.jpg' },
          { image_url: '/uploads/a.jpg' },
          { image_url: 'placeholder.jpg' },
        ],
      })
    ).toEqual(['http://127.0.0.1:3000/uploads/a.jpg'])
  })

  test('public API facility shape [{ image_url }] resolves for lightbox', async () => {
    const { collectGalleryImages } = await import('./galleryImages')
    // Canonical /api/smestaj payload after parseConcatGallery
    const facility = {
      id: 1,
      type: 'smestaj',
      cover_image: '/uploads/facilities/cover.jpg',
      gallery: [
        { image_url: '/uploads/facilities/a.jpg' },
        { image_url: '/uploads/facilities/b.jpg' },
      ],
    }
    expect(collectGalleryImages(facility)).toEqual([
      'http://127.0.0.1:3000/uploads/facilities/cover.jpg',
      'http://127.0.0.1:3000/uploads/facilities/a.jpg',
      'http://127.0.0.1:3000/uploads/facilities/b.jpg',
    ])
  })

  test('keeps absolute gallery urls and skips null entries', async () => {
    const { collectGalleryImages } = await import('./galleryImages')
    expect(
      collectGalleryImages({
        cover_image: 'https://cdn.example/cover.jpg',
        gallery: [null, { image_url: 'https://cdn.example/a.jpg' }, undefined],
      })
    ).toEqual([
      'https://cdn.example/cover.jpg',
      'https://cdn.example/a.jpg',
    ])
  })
})
