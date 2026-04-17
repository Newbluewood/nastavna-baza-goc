require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'admin123';
const SMOKE_GUEST_EMAIL = 'smoke.guest@example.test';
const SMOKE_GUEST_PASSWORD = 'SmokeGuest123';

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

async function ensureSmokeGuest() {
  const passwordHash = await bcrypt.hash(SMOKE_GUEST_PASSWORD, 10);
  await db.query(
    `
      INSERT INTO guests (email, password_hash, name, phone, created_at, is_active, vouchers)
      VALUES (?, ?, 'Smoke Guest', '060000000', NOW(), TRUE, JSON_ARRAY())
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), phone = VALUES(phone), is_active = TRUE
    `,
    [SMOKE_GUEST_EMAIL, passwordHash]
  );
}

async function cleanupSmokeGuest() {
  await db.query('DELETE FROM guests WHERE email = ?', [SMOKE_GUEST_EMAIL]);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const steps = [];
  let likedNewsRestore = null;

  const testRes = await request('/api/test');
  assert(testRes.ok, 'GET /api/test failed');
  steps.push(['GET /api/test', testRes.status]);

  const homeRes = await request('/api/home');
  assert(homeRes.ok, 'GET /api/home failed');
  steps.push(['GET /api/home', homeRes.status]);

  const facilitiesRes = await request('/api/smestaj');
  assert(facilitiesRes.ok, 'GET /api/smestaj failed');
  assert(Array.isArray(facilitiesRes.body), 'GET /api/smestaj did not return an array');
  assert(
    facilitiesRes.body.every((f) => f.type === 'smestaj'),
    'GET /api/smestaj returned non-smestaj facility'
  );
  steps.push(['GET /api/smestaj', facilitiesRes.status]);

  const firstFacility = facilitiesRes.body[0];
  if (firstFacility) {
    const facilityRes = await request(`/api/smestaj/${firstFacility.id}`);
    assert(facilityRes.ok, 'GET /api/smestaj/:id failed');
    steps.push(['GET /api/smestaj/:id', facilityRes.status]);

    const firstRoom = facilityRes.body.rooms?.[0];
    if (firstRoom) {
      const availabilityListRes = await request(`/api/rooms/${firstRoom.id}/availability`);
      assert(availabilityListRes.ok, 'GET /api/rooms/:id/availability failed');
      steps.push(['GET /api/rooms/:id/availability', availabilityListRes.status]);

      const availabilityRangeRes = await request(`/api/rooms/${firstRoom.id}/availability?start=2026-06-10&end=2026-06-12`);
      assert(availabilityRangeRes.ok, 'GET /api/rooms/:id/availability?start&end failed');
      steps.push(['GET /api/rooms/:id/availability?start&end', availabilityRangeRes.status]);
    }
  }

  const newsListRes = await request('/api/news');
  assert(newsListRes.ok, 'GET /api/news failed');
  steps.push(['GET /api/news', newsListRes.status]);

  const firstNews = Array.isArray(newsListRes.body) ? newsListRes.body[0] : null;
  if (firstNews) {
    likedNewsRestore = { id: firstNews.id, likes: firstNews.likes ?? 0 };

    const newsDetailRes = await request(`/api/news/${firstNews.slug || firstNews.id}`);
    assert(newsDetailRes.ok, 'GET /api/news/:id failed');
    steps.push(['GET /api/news/:id', newsDetailRes.status]);

    const newsLikeRes = await request(`/api/news/${firstNews.slug || firstNews.id}/like`, { method: 'POST' });
    assert(newsLikeRes.ok, 'POST /api/news/:id/like failed');
    steps.push(['POST /api/news/:id/like', newsLikeRes.status]);
  }

  const adminLoginRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });
  assert(adminLoginRes.ok && adminLoginRes.body?.token, 'POST /api/admin/login failed');
  steps.push(['POST /api/admin/login', adminLoginRes.status]);

  const adminAuth = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminLoginRes.body.token}`
  };

  const inquiriesRes = await request('/api/admin/inquiries', { headers: adminAuth });
  assert(inquiriesRes.ok, 'GET /api/admin/inquiries failed');
  steps.push(['GET /api/admin/inquiries', inquiriesRes.status]);

  const guestsRes = await request('/api/admin/guests', { headers: adminAuth });
  assert(guestsRes.ok, 'GET /api/admin/guests failed');
  steps.push(['GET /api/admin/guests', guestsRes.status]);

  await ensureSmokeGuest();

  const guestLoginRes = await request('/api/guests/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SMOKE_GUEST_EMAIL, password: SMOKE_GUEST_PASSWORD })
  });
  assert(guestLoginRes.ok && guestLoginRes.body?.token, 'POST /api/guests/login failed');
  steps.push(['POST /api/guests/login', guestLoginRes.status]);

  const guestAuth = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${guestLoginRes.body.token}`
  };

  const guestMeRes = await request('/api/guests/me', { headers: guestAuth });
  assert(guestMeRes.ok, 'GET /api/guests/me failed');
  steps.push(['GET /api/guests/me', guestMeRes.status]);

  const guestReservationsRes = await request('/api/guests/reservations', { headers: guestAuth });
  assert(guestReservationsRes.ok, 'GET /api/guests/reservations failed');
  steps.push(['GET /api/guests/reservations', guestReservationsRes.status]);

  const cancelInvalidRes = await request('/api/cancel/INVALID_SMOKE_TOKEN');
  assert(cancelInvalidRes.status === 404, 'GET /api/cancel/:token should return 404 for invalid token');
  steps.push(['GET /api/cancel/:token invalid', cancelInvalidRes.status]);

  if (likedNewsRestore) {
    await db.query('UPDATE news SET likes = ? WHERE id = ?', [likedNewsRestore.likes, likedNewsRestore.id]);
  }

  await cleanupSmokeGuest();

  console.log('Smoke test passed.');
  for (const [name, status] of steps) {
    console.log(`${status} ${name}`);
  }
}

run()
  .catch((err) => {
    console.error('Smoke test failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupSmokeGuest().catch(() => {});
    await db.end();
  });