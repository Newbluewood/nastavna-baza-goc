const { sendError } = require('../../utils/response');
const { notifyKnowledgeIngest } = require('../../services/knowledgeIngestNotify');

function scheduleStaffIngest(reason) {
  // Fire-and-forget: staff save must not wait on Qdrant refresh.
  void notifyKnowledgeIngest(reason || 'staff-cms');
}

async function getStaff(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT s.*, st.role as role_en
    FROM staff s
    LEFT JOIN staff_translations st ON s.id = st.entity_id AND st.lang = 'en'
    ORDER BY s.id ASC
  `);
  res.json(rows);
}

async function createStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, role_en, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'INSERT INTO staff (full_name, role, contact_email, photo_url) VALUES (?, ?, ?, ?)',
    [full_name, role || null, contact_email || null, photo_url || null]
  );
  if (role_en) {
    await db.query(
      'INSERT INTO staff_translations (entity_id, lang, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
      [result.insertId, 'en', role_en]
    );
  }
  scheduleStaffIngest('staff-create');
  res.json({ message: 'Staff member created', staffId: result.insertId });
}

async function updateStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, role_en, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'UPDATE staff SET full_name = ?, role = ?, contact_email = ?, photo_url = ? WHERE id = ?',
    [full_name, role || null, contact_email || null, photo_url || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Staff member not found');

  await db.query(
    'INSERT INTO staff_translations (entity_id, lang, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
    [req.params.id, 'en', role_en || null]
  );
  scheduleStaffIngest('staff-update');
  res.json({ message: 'Staff member updated' });
}

async function deleteStaffMember(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Staff member not found');
  scheduleStaffIngest('staff-delete');
  res.json({ message: 'Staff member deleted' });
}

module.exports = {
  getStaff,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
};
