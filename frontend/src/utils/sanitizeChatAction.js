/**
 * Site alias for the shared reservation action contract.
 * Canonical file is vendored from chat-agent/shared/reservationActionContract.js.
 * Do not change the contract here — sync it from the agent repo.
 */
export {
  sanitizeReservationAction as sanitizeChatAction,
  toIsoDate,
  ALLOWED_ACTION_TYPES,
  ALLOWED_BOARD_TYPES,
  RESERVATION_ACTION_CONTRACT,
} from './reservationActionContract.js'
