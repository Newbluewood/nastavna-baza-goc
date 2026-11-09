import { describe, expect, test } from 'vitest'
import {
  facilityPublicPath,
  newsPublicPath,
  themePublicPath,
  facilityPublicPathSafe,
  facilityLocation,
  newsLocationSafe,
  themeLocationSafe,
  locationFromPath,
} from './publicPaths'

describe('publicPaths', () => {
  test('builds slug URLs', () => {
    expect(facilityPublicPath({ slug: 'hotel-piramida' })).toBe('/smestaj/hotel-piramida')
    expect(newsPublicPath({ slug: 'zimska-sezona' })).toBe('/vesti/zimska-sezona')
    expect(themePublicPath({ slug: 'biljni_i_zivotinjski_svet' })).toBe('/istrazi/biljni_i_zivotinjski_svet')
  })

  test('safe fallback keeps old id bookmarks working', () => {
    expect(facilityPublicPathSafe({ id: 1 })).toBe('/smestaj/1')
    expect(facilityPublicPathSafe({ slug: 'hotel-piramida', id: 1 })).toBe('/smestaj/hotel-piramida')
  })

  test('named locations for Router 4 navigation', () => {
    expect(facilityLocation({ slug: 'hotel-piramida' })).toEqual({
      name: 'smestaj-single',
      params: { slug: 'hotel-piramida' },
    })
    expect(newsLocationSafe({ slug: 'zimska-sezona' })).toEqual({
      name: 'single-news',
      params: { slug: 'zimska-sezona' },
    })
    expect(themeLocationSafe({ id: 3 })).toEqual({
      name: 'tema-detail',
      params: { slug: '3' },
    })
    expect(locationFromPath('/smestaj')).toEqual({ name: 'smestaj' })
    expect(locationFromPath('/vesti/foo')).toEqual({
      name: 'single-news',
      params: { slug: 'foo' },
    })
  })
})
