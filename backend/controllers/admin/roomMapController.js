function inferCapacityType(capacityStr, capacityMax) {
  if (capacityMax) {
    if (capacityMax <= 1) return 'single';
    if (capacityMax <= 2) return 'double';
    if (capacityMax <= 3) return 'triple';
    return 'multi';
  }
  if (!capacityStr) return 'multi';
  const s = capacityStr.toLowerCase();
  if (/\b1\b/.test(s) && (s.includes('особ') || s.includes('os') || s.includes('jednokrevet') || s.includes('jednokreветн'))) return 'single';
  if (/\b2\b/.test(s)) return 'double';
  if (/\b3\b/.test(s)) return 'triple';
  if (/jednokrevetna|jednokrevet|1 особ/i.test(s)) return 'single';
  if (/dvokrevetna|dvokrevet|2 особ/i.test(s)) return 'double';
  if (/trokrevetna|trokrevet|3 особ/i.test(s)) return 'triple';
  return 'multi';
}

async function getRoomMap(req, res) {
  const db = req.app.locals.db;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const [facilities] = await db.query(`
    SELECT id, name FROM facilities WHERE type = 'smestaj' ORDER BY id
  `);

  const [rooms] = await db.query(`
    SELECT r.id, r.facility_id, r.name, r.capacity, r.capacity_max,
           res.id AS res_id, res.start_date, res.end_date,
           COALESCE(i.sender_name, g.name, res.guest_name) AS guest_display_name,
           COALESCE(i.email, g.email) AS guest_email
    FROM rooms r
    LEFT JOIN reservations res
      ON res.room_id = r.id
      AND res.status != 'cancelled'
      AND res.start_date <= ? AND res.end_date > ?
    LEFT JOIN inquiries i ON i.id = res.inquiry_id
    LEFT JOIN guests g ON g.id = i.guest_id
    ORDER BY r.facility_id, r.id
  `, [date, date]);

  const facilityMap = {};
  for (const f of facilities) {
    facilityMap[f.id] = { id: f.id, name: f.name, rooms: [] };
  }

  for (const room of rooms) {
    if (!facilityMap[room.facility_id]) continue;
    facilityMap[room.facility_id].rooms.push({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      capacity_type: inferCapacityType(room.capacity, room.capacity_max),
      is_occupied: !!room.res_id,
      reservation: room.res_id ? {
        check_in: room.start_date,
        check_out: room.end_date,
        guest_name: room.guest_display_name || '—',
        guest_email: room.guest_email || null
      } : null
    });
  }

  res.json({ date, facilities: Object.values(facilityMap) });
}

module.exports = { getRoomMap };
