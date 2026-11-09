/**
 * Whitelist + coerce chat SSE `action` payloads before UI / deep-link use.
 * Unknown types and unsafe shapes become null.
 */

export const ALLOWED_ACTION_TYPES = Object.freeze(['open_reservation_form'])
export const ALLOWED_BOARD_TYPES = Object.freeze(['base', 'half', 'full'])

const MAX_NAME = 80
const MAX_EMAIL = 120
const MAX_PHONE = 32
const MAX_ROOM_LABEL = 120
const MAX_SLUG = 80
const MAX_ROOM_OPTIONS = 20
const MAX_STAY_DAYS = 60
const MAX_DAYS_AHEAD = 730

function clip(value, max) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.length > max ? s.slice(0, max) : s
}

function stripControls(value) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim()
}

export function toIsoDate(value) {
  if (!value) return ''
  const s = stripControls(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  return ''
}

function isValidIsoDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

function isReasonableStayDate(iso) {
  if (!isValidIsoDate(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  const today = new Date()
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1)
  const end = start + MAX_DAYS_AHEAD * 86400000
  const t = d.getTime()
  return t >= start && t <= end
}

function positiveInt(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000_000) return null
  return n
}

function sanitizeEmail(value) {
  const email = clip(stripControls(value).toLowerCase(), MAX_EMAIL)
  if (!email) return ''
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return ''
  return email
}

function sanitizePhone(value) {
  const raw = clip(stripControls(value), MAX_PHONE)
  if (!raw) return ''
  if (!/^[+\d][\d\s()./-]{5,30}$/.test(raw)) return ''
  return raw
}

function sanitizeSlug(value) {
  const slug = clip(stripControls(value).toLowerCase(), MAX_SLUG)
  if (!slug) return ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return ''
  return slug
}

function sanitizeRoomOption(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = positiveInt(raw.id)
  if (!id) return null
  const option = {
    id,
    name: clip(stripControls(raw.name), MAX_ROOM_LABEL),
  }
  const facilityId = positiveInt(raw.facility_id)
  if (facilityId) option.facility_id = facilityId
  const facilityName = clip(stripControls(raw.facility_name), MAX_ROOM_LABEL)
  if (facilityName) option.facility_name = facilityName
  return option
}

function sanitizeRoomOptionList(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const item of list) {
    if (out.length >= MAX_ROOM_OPTIONS) break
    const clean = sanitizeRoomOption(item)
    if (clean) out.push(clean)
  }
  return out
}

/**
 * @param {unknown} action
 * @returns {object|null}
 */
export function sanitizeChatAction(action) {
  if (!action || typeof action !== 'object') return null
  if (!ALLOWED_ACTION_TYPES.includes(action.type)) return null

  const board = String(action.board_type || 'base').trim().toLowerCase()
  const board_type = ALLOWED_BOARD_TYPES.includes(board) ? board : 'base'

  let check_in = toIsoDate(action.check_in)
  let check_out = toIsoDate(action.check_out)
  if (check_in && !isReasonableStayDate(check_in)) check_in = ''
  if (check_out && !isReasonableStayDate(check_out)) check_out = ''
  if (check_in && check_out) {
    const inMs = Date.parse(`${check_in}T00:00:00Z`)
    const outMs = Date.parse(`${check_out}T00:00:00Z`)
    const nights = (outMs - inMs) / 86400000
    if (!(nights > 0) || nights > MAX_STAY_DAYS) {
      check_in = ''
      check_out = ''
    }
  }

  const room_id = positiveInt(action.room_id)
  const facility_id = positiveInt(action.facility_id)
  const target_room =
    clip(stripControls(action.target_room || action.room_name), MAX_ROOM_LABEL) || undefined

  const clean = {
    type: 'open_reservation_form',
    board_type,
  }

  if (room_id) clean.room_id = room_id
  if (facility_id) clean.facility_id = facility_id
  if (target_room) clean.target_room = target_room

  const facility_name = clip(stripControls(action.facility_name), MAX_ROOM_LABEL)
  if (facility_name) clean.facility_name = facility_name

  const facility_slug = sanitizeSlug(action.facility_slug)
  if (facility_slug) clean.facility_slug = facility_slug

  if (check_in) clean.check_in = check_in
  if (check_out) clean.check_out = check_out

  const guest_name = clip(stripControls(action.guest_name), MAX_NAME)
  if (guest_name) clean.guest_name = guest_name

  const guest_email = sanitizeEmail(action.guest_email)
  if (guest_email) clean.guest_email = guest_email

  const guest_phone = sanitizePhone(action.guest_phone)
  if (guest_phone) clean.guest_phone = guest_phone

  if (action.needs_room_choice === true) clean.needs_room_choice = true

  const room_options = sanitizeRoomOptionList(action.room_options)
  if (room_options.length) clean.room_options = room_options

  const alternative_rooms = sanitizeRoomOptionList(action.alternative_rooms)
  if (alternative_rooms.length) clean.alternative_rooms = alternative_rooms

  const source = clip(stripControls(action.source), 40)
  if (source && ['agent_summary', 'mixed', 'fallback'].includes(source)) {
    clean.source = source
  }

  return clean
}
