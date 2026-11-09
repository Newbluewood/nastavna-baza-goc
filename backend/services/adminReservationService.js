'use strict'

const crypto = require('crypto')
const emailService = require('./emailService')
const { INQUIRY_STATUS, INQUIRY_SOURCE } = require('../config/constants')
const logger = require('../utils/logger')

async function sendEmailSafely(label, fn) {
  try {
    await fn()
  } catch (error) {
    logger.warn(`[ADMIN RESERVATION EMAIL] ${label} failed: ${error.message}`)
  }
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Create a confirmed reservation from CMS (same guest/inquiry model as public flow).
 */
async function createAdminConfirmedReservation(db, payload) {
  const {
    sender_name,
    email,
    phone,
    message,
    target_room_id,
    check_in,
    check_out,
    board_type = 'base',
    send_email = true,
    adminId = null,
    adminUsername = null,
  } = payload

  if (!sender_name || !email || !target_room_id || !check_in || !check_out) {
    const err = new Error('Missing required reservation fields')
    err.code = 'VALIDATION'
    throw err
  }

  if (check_in >= check_out) {
    const err = new Error('check_out must be after check_in')
    err.code = 'VALIDATION'
    throw err
  }

  if (check_in < todayYmd()) {
    const err = new Error('check_in cannot be in the past')
    err.code = 'VALIDATION'
    throw err
  }

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [conflicts] = await connection.query(
      `
      SELECT id FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
      AND (
        (start_date < ? AND end_date > ?) OR
        (start_date < ? AND end_date > ?) OR
        (start_date >= ? AND end_date <= ?)
      )
      LIMIT 1
      `,
      [target_room_id, check_out, check_in, check_out, check_in, check_in, check_out]
    )

    if (conflicts.length > 0) {
      const err = new Error('Room is not available for the selected dates')
      err.code = 'ROOM_UNAVAILABLE'
      throw err
    }

    const [rooms] = await connection.query(
      `
      SELECT r.id, r.name AS room_name, f.name AS facility_name
      FROM rooms r
      LEFT JOIN facilities f ON f.id = r.facility_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [target_room_id]
    )
    if (rooms.length === 0) {
      const err = new Error('Room not found')
      err.code = 'NOT_FOUND'
      throw err
    }
    const roomMeta = rooms[0]

    let guestId
    let newAccount = false
    let temporaryPassword = null

    const [existingGuests] = await connection.query(
      'SELECT id, name, email FROM guests WHERE email = ? LIMIT 1',
      [email]
    )

    if (existingGuests.length > 0) {
      guestId = existingGuests[0].id
    } else {
      const bcrypt = require('bcryptjs')
      temporaryPassword = Math.random().toString(36).slice(-8)
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10)
      const [guestInsert] = await connection.query(
        'INSERT INTO guests (name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, NOW())',
        [sender_name, email, phone || null, hashedPassword]
      )
      guestId = guestInsert.insertId
      newAccount = true
    }

    const [inquiryInsert] = await connection.query(
      `
      INSERT INTO inquiries (
        sender_name, email, phone, message, check_in, check_out, target_room_id,
        status, created_at, guest_id, board_type, source,
        created_by_admin_id, created_by_admin_username
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
      `,
      [
        sender_name,
        email,
        phone || null,
        message || `CMS rezervacija (${adminUsername || 'admin'})`,
        check_in,
        check_out,
        target_room_id,
        INQUIRY_STATUS.APPROVED,
        guestId,
        board_type || 'base',
        INQUIRY_SOURCE.ADMIN_CMS,
        adminId,
        adminUsername,
      ]
    )

    const inquiryId = inquiryInsert.insertId
    const cancelToken = crypto.randomBytes(16).toString('hex')

    await connection.query(
      `
      INSERT INTO reservations (inquiry_id, room_id, start_date, end_date, status, cancel_token, guest_name, guest_id)
      VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)
      `,
      [inquiryId, target_room_id, check_in, check_out, cancelToken, sender_name, guestId]
    )

    await connection.commit()

    if (send_email) {
      if (newAccount && temporaryPassword) {
        await sendEmailSafely('sendGuestCreated', () =>
          emailService.sendGuestCreated(email, {
            name: sender_name,
            email,
            password: temporaryPassword,
          })
        )
      }
      await sendEmailSafely('sendApproved', () =>
        emailService.sendApproved(email, {
          name: sender_name,
          facility: roomMeta.facility_name,
          room: roomMeta.room_name,
          checkIn: check_in,
          checkOut: check_out,
          cancelToken,
          guestCount: 1,
        })
      )
    }

    return {
      inquiryId,
      guestId,
      newAccount,
      cancelToken,
      room: roomMeta.room_name,
      facility: roomMeta.facility_name,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = { createAdminConfirmedReservation }
