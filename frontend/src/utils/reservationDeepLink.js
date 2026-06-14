/**
 * Deep link na InquiryModal (ista forma kao "Pošalji upit" na stranici smeštaja).
 * @param {object} action — open_reservation_form payload iz chat-agenta
 * @returns {{ path: string, query: Record<string, string> } | null}
 */
export function buildReservationRoute(action) {
  if (!action || action.type !== 'open_reservation_form') return null;
  if (!action.facility_id || !action.room_id) return null;

  const query = {
    openInquiry: '1',
    roomId: String(action.room_id),
  };

  if (action.check_in) query.checkIn = action.check_in;
  if (action.check_out) query.checkOut = action.check_out;
  if (action.guest_name) query.guestName = action.guest_name;
  if (action.guest_email) query.guestEmail = action.guest_email;
  if (action.guest_phone) query.guestPhone = action.guest_phone;
  if (action.board_type && action.board_type !== 'base') query.boardType = action.board_type;
  if (action.target_room) query.roomName = action.target_room;

  return {
    path: `/smestaj/${action.facility_id}`,
    query,
  };
}

export function canOpenSiteReservationForm(action) {
  if (!action || action.type !== 'open_reservation_form') return false;
  return !!(action.room_id);
}
