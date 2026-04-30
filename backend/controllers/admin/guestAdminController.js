const { sendError } = require('../../utils/response');

async function getGuests(req, res) {
  const db = req.app.locals.db;

  const [guests] = await db.query(`
    SELECT g.*, COUNT(i.id) as inquiry_count, COUNT(r.id) as reservation_count
    FROM guests g
    LEFT JOIN inquiries i ON g.id = i.guest_id
    LEFT JOIN reservations r ON i.id = r.inquiry_id AND r.status = 'confirmed'
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `);

  res.json(guests);
}

async function addVoucher(req, res) {
  const db = req.app.locals.db;
  const guestId = req.params.id;
  const { title } = req.body;

  if (!title) return sendError(res, 400, 'Title required');

  const [guests] = await db.query('SELECT vouchers FROM guests WHERE id = ?', [guestId]);
  if (guests.length === 0) return sendError(res, 404, 'Guest not found');

  let currentVouchers = [];
  try {
    currentVouchers = guests[0].vouchers ? JSON.parse(guests[0].vouchers) : [];
  } catch {
    currentVouchers = Array.isArray(guests[0].vouchers) ? guests[0].vouchers : [];
  }

  const voucherId = Math.random().toString(36).substring(2, 10).toUpperCase();
  currentVouchers.push({
    id: voucherId,
    title,
    status: 'active',
    created_at: new Date().toISOString()
  });

  await db.query(
    'UPDATE guests SET vouchers = ? WHERE id = ?',
    [JSON.stringify(currentVouchers), guestId]
  );

  res.json({ message: 'Voucher created successfully', voucherId });
}

module.exports = { getGuests, addVoucher };
