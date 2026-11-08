import { describe, expect, test } from 'vitest'
import { assertApiPayload } from './apiPayload'

describe('assertApiPayload', () => {
  test('passes through normal payloads', () => {
    expect(assertApiPayload({ pageTitle: 'X', news: [] })).toEqual({ pageTitle: 'X', news: [] })
    expect(assertApiPayload([])).toEqual([])
    expect(assertApiPayload(null)).toBe(null)
  })

  test('throws on bare { error } bodies', () => {
    expect(() => assertApiPayload({ error: 'read ECONNRESET' })).toThrow('read ECONNRESET')
  })

  test('allows objects that include error plus real fields', () => {
    expect(assertApiPayload({ error: 'partial', facilities: [] })).toEqual({
      error: 'partial',
      facilities: [],
    })
  })
})
