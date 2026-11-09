/**
 * Upsert English translation row for a given translation table.
 * Table name must be a known schema identifier (not user input).
 */
async function upsertEnTranslation(db, table, entityId, fields) {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE entity_id = ? AND lang = 'en' LIMIT 1`,
    [entityId]
  );

  const keys = Object.keys(fields);
  const values = keys.map((key) => fields[key]);
  const hasValue = values.some((value) => value);

  if (rows.length) {
    await db.query(
      `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...values, rows[0].id]
    );
    return;
  }

  if (!hasValue) return;

  await db.query(
    `INSERT INTO ${table} (entity_id, lang, ${keys.join(', ')}) VALUES (?, 'en', ${keys.map(() => '?').join(', ')})`,
    [entityId, ...values]
  );
}

module.exports = { upsertEnTranslation };
