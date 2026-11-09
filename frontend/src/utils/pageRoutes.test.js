import { describe, expect, test } from 'vitest'
import {
  publicPathForSlug,
  isModulePageSlug,
  isValidPageSlugFormat,
  isReservedPageSlug,
} from './pageRoutes'

describe('publicPathForSlug', () => {
  test('maps short and generic CMS paths', () => {
    expect(publicPathForSlug('pocetna')).toBe('/')
    expect(publicPathForSlug('edukacija')).toBe('/edukacija')
    expect(publicPathForSlug('restoran')).toBe('/restoran')
    expect(publicPathForSlug('vesti')).toBe('/vesti')
    expect(publicPathForSlug('kontakt')).toBe('/kontakt')
    expect(publicPathForSlug('istrazi')).toBe('/istrazi')
    expect(publicPathForSlug('o-nama')).toBe('/o-nama')
  })

  test('module shells are not auto CMS-nav candidates', () => {
    expect(isModulePageSlug('pocetna')).toBe(true)
    expect(isModulePageSlug('vesti')).toBe(true)
    expect(isModulePageSlug('test-test')).toBe(false)
  })

  test('slug format and reserved list', () => {
    expect(isValidPageSlugFormat('o-nama')).toBe(true)
    expect(isValidPageSlugFormat('O-Nama')).toBe(false)
    expect(isValidPageSlugFormat('o_nama')).toBe(false)
    expect(isReservedPageSlug('admin')).toBe(true)
    expect(isReservedPageSlug('smestaj')).toBe(true)
    expect(isReservedPageSlug('o-nama')).toBe(false)
  })
})
