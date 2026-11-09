import { sanitizeChatAction } from './sanitizeChatAction'

/**
 * Deep link na InquiryModal (ista forma kao "Pošalji upit" na stranici smeštaja).
 * @param {object} rawAction — open_reservation_form payload iz chat-agenta
 * @returns {{ path: string, query: Record<string, string> } | null}
 */
export function buildReservationRoute(rawAction) {
  const action = sanitizeChatAction(rawAction)
  if (!action || !action.facility_id || !action.room_id) return null

  const query = {
    openInquiry: '1',
    roomId: String(action.room_id),
  }

  if (action.check_in) query.checkIn = action.check_in
  if (action.check_out) query.checkOut = action.check_out
  if (action.guest_name) query.guestName = action.guest_name
  if (action.guest_email) query.guestEmail = action.guest_email
  if (action.guest_phone) query.guestPhone = action.guest_phone
  if (action.board_type && action.board_type !== 'base') query.boardType = action.board_type
  if (action.target_room) query.roomName = action.target_room

  // Prefer slug when chat sends it; numeric id still works (detail page redirects to slug).
  const facilityKey = action.facility_slug || action.facility_id
  return {
    path: `/smestaj/${facilityKey}`,
    query,
  }
}

export function canOpenSiteReservationForm(rawAction) {
  const action = sanitizeChatAction(rawAction)
  if (!action) return false
  return !!action.room_id
}

export { sanitizeChatAction }
