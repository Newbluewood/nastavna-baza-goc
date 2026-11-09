import { describe, expect, it } from 'vitest'
import { sanitizeChatAction, toIsoDate } from './sanitizeChatAction'

describe('sanitizeChatAction', () => {
  it('returns null for unknown action types', () => {
    expect(sanitizeChatAction({ type: 'delete_everything', room_id: 1 })).toBeNull()
    expect(sanitizeChatAction(null)).toBeNull()
    expect(sanitizeChatAction('open_reservation_form')).toBeNull()
  })

  it('keeps only whitelisted fields and coerces ids', () => {
    const clean = sanitizeChatAction({
      type: 'open_reservation_form',
      room_id: '12',
      facility_id: 3,
      board_type: 'half',
      target_room: 'Soba 101',
      guest_email: 'Guest@Example.com',
      evil: '<script>',
      __proto__: { polluted: true },
    })
    expect(clean).toEqual({
      type: 'open_reservation_form',
      room_id: 12,
      facility_id: 3,
      board_type: 'half',
      target_room: 'Soba 101',
      guest_email: 'guest@example.com',
    })
    expect(clean).not.toHaveProperty('evil')
  })

  it('defaults invalid board_type to base', () => {
    const clean = sanitizeChatAction({
      type: 'open_reservation_form',
      room_id: 1,
      board_type: 'all_inclusive_hack',
    })
    expect(clean.board_type).toBe('base')
  })

  it('drops invalid or inverted stay dates', () => {
    const badRange = sanitizeChatAction({
      type: 'open_reservation_form',
      room_id: 1,
      check_in: '2030-01-10',
      check_out: '2030-01-05',
    })
    expect(badRange.check_in).toBeUndefined()
    expect(badRange.check_out).toBeUndefined()

    const invalid = sanitizeChatAction({
      type: 'open_reservation_form',
      room_id: 1,
      check_in: 'not-a-date',
      check_out: 'also-bad',
    })
    expect(invalid.check_in).toBeUndefined()
    expect(invalid.check_out).toBeUndefined()
  })

  it('normalizes DMY dates to ISO', () => {
    expect(toIsoDate('5.11.2026')).toBe('2026-11-05')
    const clean = sanitizeChatAction({
      type: 'open_reservation_form',
      room_id: 1,
      check_in: '10.11.2026',
      check_out: '12.11.2026',
    })
    expect(clean.check_in).toBe('2026-11-10')
    expect(clean.check_out).toBe('2026-11-12')
  })

  it('sanitizes room option lists', () => {
    const clean = sanitizeChatAction({
      type: 'open_reservation_form',
      room_options: [
        { id: 1, name: 'A', facility_id: 2, facility_name: 'Pir', extra: true },
        { id: 'nope', name: 'B' },
        null,
      ],
    })
    expect(clean.room_options).toEqual([
      { id: 1, name: 'A', facility_id: 2, facility_name: 'Pir' },
    ])
  })
})
