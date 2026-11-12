const { sendError } = require('../../utils/response');
const { scheduleKnowledgeIngest } = require('../../services/knowledgeIngestNotify');

async function getProjects(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT p.*, pt.title as title_en, pt.description as description_en
    FROM projects p
    LEFT JOIN project_translations pt ON p.id = pt.entity_id AND pt.lang = 'en'
    ORDER BY p.id DESC
  `);
  res.json(rows);
}

async function createProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, title_en, description_en, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'INSERT INTO projects (title, description, status, start_date) VALUES (?, ?, ?, ?)',
    [title, description || null, status || 'активан', start_date || null]
  );
  if (title_en || description_en) {
    await db.query(
      'INSERT INTO project_translations (entity_id, lang, title, description) VALUES (?, ?, ?, ?)',
      [result.insertId, 'en', title_en || null, description_en || null]
    );
  }
  scheduleKnowledgeIngest('project-create');
  res.json({ message: 'Project created', projectId: result.insertId });
}

async function updateProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, title_en, description_en, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE projects SET title = ?, description = ?, status = ?, start_date = ? WHERE id = ?',
    [title, description || null, status || 'активан', start_date || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Project not found');

  await db.query(
    'INSERT INTO project_translations (entity_id, lang, title, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)',
    [req.params.id, 'en', title_en || null, description_en || null]
  );
  scheduleKnowledgeIngest('project-update');
  res.json({ message: 'Project updated' });
}

async function deleteProject(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Project not found');
  scheduleKnowledgeIngest('project-delete');
  res.json({ message: 'Project deleted' });
}

module.exports = {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
};
