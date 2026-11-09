'use strict'

const { INQUIRY_STATUS, INQUIRY_PENDING_MAX_DAYS } = require('../config/constants')

/**
 * Auto-close stale pending inquiries so months-old "novo" rows don't linger.
 *
 * Rules for status = novo:
 *  1) check_in date is before today → isteklo
 *  2) created_at older than INQUIRY_PENDING_MAX_DAYS → isteklo
 *
 * Does not touch reservations (novo never holds a confirmed booking).
 *
 * @returns {Promise<number>} number of rows updated
 */
async function expireStaleInquiries(db) {
  const maxDays = Number(INQUIRY_PENDING_MAX_DAYS) || 14

  const [resultPastCheckIn] = await db.query(
    `
    UPDATE inquiries
    SET status = ?,
        rejection_reason = COALESCE(rejection_reason, 'Automatski isteklo: datum dolaska je prošao.')
    WHERE status = ?
      AND check_in IS NOT NULL
      AND check_in < CURDATE()
    `,
    [INQUIRY_STATUS.EXPIRED, INQUIRY_STATUS.NEW]
  )

  const [resultOld] = await db.query(
    `
    UPDATE inquiries
    SET status = ?,
        rejection_reason = COALESCE(rejection_reason, ?)
    WHERE status = ?
      AND created_at < (NOW() - INTERVAL ? DAY)
    `,
    [
      INQUIRY_STATUS.EXPIRED,
      `Automatski isteklo: nema odgovora u roku od ${maxDays} dana.`,
      INQUIRY_STATUS.NEW,
      maxDays,
    ]
  )

  return Number(resultPastCheckIn?.affectedRows || 0) + Number(resultOld?.affectedRows || 0)
}

module.exports = { expireStaleInquiries }
