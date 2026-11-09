require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'admin123';
const SMOKE_GUEST_PASSWORD = 'SmokeWriteGuest123';

function ymd(date) {
  return date.toISOString().split('T')[0];
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, ok: response.ok, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

async function fetchFirstRoomId() {
  const facilitiesRes = await request('/api/smestaj');
  assertOk(facilitiesRes, 'GET /api/smestaj');
  const facilities = Array.isArray(facilitiesRes.body)
    ? facilitiesRes.body
    : facilitiesRes.body?.facilities;
  assert(Array.isArray(facilities) && facilities.length > 0, 'GET /api/smestaj returned no facilities');

  const facility = facilities[0];
  assert(facility?.id, 'No facility available for write-flow smoke test');

  const facilityRes = await request(`/api/smestaj/${facility.id}`);
  assertOk(facilityRes, 'GET /api/smestaj/:id');

  const room = facilityRes.body?.rooms?.[0];
  assert(room?.id, 'No room available for write-flow smoke test');

  return room.id;
}

async function adminLogin() {
  const loginRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });

  assertOk(loginRes, 'POST /api/admin/login');
  assert(loginRes.body?.token, 'Admin login response missing token');
  return loginRes.body.token;
}

async function cleanupByEmail(email) {
  const [inquiries] = await db.query('SELECT id FROM inquiries WHERE email = ?', [email]);
  const inquiryIds = inquiries.map((row) => row.id);

  if (inquiryIds.length > 0) {
    await db.query(`DELETE FROM reservations WHERE inquiry_id IN (${inquiryIds.map(() => '?').join(',')})`, inquiryIds);
    await db.query(`DELETE FROM inquiries WHERE id IN (${inquiryIds.map(() => '?').join(',')})`, inquiryIds);
  }

  await db.query('DELETE FROM guests WHERE email = ?', [email]);
}

async function run() {
  const marker = Date.now();
  const smokeEmail = `smoke.write.${marker}@example.test`;
  const smokeName = `Smoke Writer ${marker}`;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 20);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);

  const timeline = [];
  let inquiryId = null;
  let cancelToken = null;

  try {
    const roomId = await fetchFirstRoomId();
    timeline.push('room selected');

    const inquiryRes = await request('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_name: smokeName,
        email: smokeEmail,
        phone: '0601112233',
        message: 'Smoke write flow test',
        target_room_id: roomId,
        check_in: ymd(checkIn),
        check_out: ymd(checkOut)
      })
    });

    assertOk(inquiryRes, 'POST /api/inquiries');
    inquiryId = inquiryRes.body?.inquiryId;
    assert(inquiryId, 'Inquiry id missing after POST /api/inquiries');
    assert(inquiryRes.body?.newAccount === true, 'Expected new guest account from inquiry');
    assert(inquiryRes.body?.guestId, 'guestId missing after POST /api/inquiries');
    timeline.push(`inquiry created ${inquiryId} (guest ${inquiryRes.body.guestId})`);

    // Password is emailed only — set a known hash so guest portal can be exercised.
    const passwordHash = await bcrypt.hash(SMOKE_GUEST_PASSWORD, 10);
    await db.query('UPDATE guests SET password_hash = ?, is_active = TRUE WHERE email = ?', [
      passwordHash,
      smokeEmail
    ]);
    timeline.push('guest password set for portal smoke');

    const adminToken = await adminLogin();
    timeline.push('admin login ok');

    const adminListRes = await request('/api/admin/inquiries', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertOk(adminListRes, 'GET /api/admin/inquiries');
    const listed = Array.isArray(adminListRes.body)
      ? adminListRes.body
      : adminListRes.body?.inquiries || adminListRes.body?.data || [];
    assert(
      listed.some((row) => Number(row.id) === Number(inquiryId)),
      'Created inquiry not visible in admin list'
    );
    timeline.push('admin sees inquiry');

    const approvalRes = await request(`/api/admin/inquiries/${inquiryId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'obradjeno' })
    });

    assertOk(approvalRes, 'POST /api/admin/inquiries/:id/status (obradjeno)');
    timeline.push('inquiry approved');

    const [reservationRows] = await db.query('SELECT id, cancel_token, status FROM reservations WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
    assert(reservationRows.length === 1, 'Reservation was not created after approval');
    assert(reservationRows[0].status === 'confirmed', 'Reservation status is not confirmed after approval');
    cancelToken = reservationRows[0].cancel_token;
    assert(cancelToken, 'Cancel token missing after approval');
    timeline.push('reservation created with cancel token');

    const guestLoginRes = await request('/api/guests/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smokeEmail, password: SMOKE_GUEST_PASSWORD })
    });
    assertOk(guestLoginRes, 'POST /api/guests/login');
    assert(guestLoginRes.body?.token, 'Guest login missing token');
    timeline.push('guest login ok');

    const guestAuth = {
      Authorization: `Bearer ${guestLoginRes.body.token}`
    };
    const guestReservationsRes = await request('/api/guests/reservations', { headers: guestAuth });
    assertOk(guestReservationsRes, 'GET /api/guests/reservations');
    const guestRows = Array.isArray(guestReservationsRes.body) ? guestReservationsRes.body : [];
    assert(
      guestRows.some(
        (row) =>
          Number(row.inquiry_id) === Number(inquiryId) &&
          row.reservation_status === 'confirmed'
      ),
      'Approved reservation not visible on guest dashboard'
    );
    timeline.push('guest dashboard shows reservation');

    const cancelInfoRes = await request(`/api/cancel/${cancelToken}`);
    assertOk(cancelInfoRes, 'GET /api/cancel/:token valid');
    timeline.push('cancel info loaded');

    const cancelRes = await request(`/api/cancel/${cancelToken}`, { method: 'POST' });
    assertOk(cancelRes, 'POST /api/cancel/:token valid');
    timeline.push('reservation cancelled');

    const [afterCancelRes] = await db.query('SELECT status FROM reservations WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
    assert(afterCancelRes.length === 1 && afterCancelRes[0].status === 'cancelled', 'Reservation not marked as cancelled');

    const [afterCancelInquiry] = await db.query('SELECT status FROM inquiries WHERE id = ? LIMIT 1', [inquiryId]);
    assert(afterCancelInquiry.length === 1 && afterCancelInquiry[0].status === 'otkazano', 'Inquiry not marked as otkazano');
    timeline.push('db statuses verified');

    console.log('Write-flow smoke test passed (inquiry → admin → guest → cancel).');
    timeline.forEach((line, index) => console.log(`${index + 1}. ${line}`));
  } finally {
    await cleanupByEmail(smokeEmail).catch(() => {});
  }
}

run()
  .catch((err) => {
    console.error('Write-flow smoke test failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
