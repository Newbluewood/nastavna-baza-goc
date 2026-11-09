/**
 * Lightweight checks for expireStaleInquiries (uses live DB).
 * Run: node tests/standalone/test-inquiry-expiry.js
 */
require('dotenv').config()
const assert = require('node:assert/strict')
const db = require('../../db')
const { expireStaleInquiries } = require('../../services/inquiryExpiryService')
const { INQUIRY_STATUS } = require('../../config/constants')

async function run() {
  const marker = `expiry-smoke-${Date.now()}`
  const email = `${marker}@example.test`

  const [insert] = await db.query(
    `
    INSERT INTO inquiries (
      sender_name, email, phone, message, check_in, check_out, target_room_id,
      status, created_at, board_type
    ) VALUES (?, ?, '060000000', ?, '2020-01-01', '2020-01-03', 1, ?, DATE_SUB(NOW(), INTERVAL 60 DAY), 'base')
    `,
    [marker, email, marker, INQUIRY_STATUS.NEW]
  )
  const id = insert.insertId

  const expiredCount = await expireStaleInquiries(db)
  assert.ok(expiredCount >= 1, 'expected at least one expiry')

  const [rows] = await db.query('SELECT status, rejection_reason FROM inquiries WHERE id = ?', [id])
  assert.equal(rows[0].status, INQUIRY_STATUS.EXPIRED)
  assert.match(String(rows[0].rejection_reason || ''), /isteklo/i)

  await db.query('DELETE FROM inquiries WHERE id = ?', [id])
  console.log('inquiry expiry: ok')
}

run()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
  })
