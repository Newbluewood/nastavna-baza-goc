const {
  pathForPageSlug,
  shouldAutoAddNavForSlug,
  MODULE_PAGE_SLUGS,
  MODULE_NAV_LABELS,
  SHORT_PAGE_PATHS,
} = require('../utils/navPaths');

async function renumberAll(db) {
  const [rows] = await db.query('SELECT id FROM nav_items ORDER BY sort_order ASC, id ASC');
  for (let i = 0; i < rows.length; i += 1) {
    await db.query('UPDATE nav_items SET sort_order = ? WHERE id = ?', [i + 1, rows[i].id]);
  }
}

/** Rewrite legacy /stranica/{slug} menu paths to /{slug}. */
async function normalizeStranicaNavPaths(db) {
  const [rows] = await db.query(
    "SELECT id, path FROM nav_items WHERE path LIKE '/stranica/%'"
  );
  if (!rows.length) return;

  for (const row of rows) {
    const slug = String(row.path).replace(/^\/stranica\//, '');
    if (!slug) continue;
    const next = pathForPageSlug(slug);
    if (next === row.path) continue;
    try {
      await db.query('UPDATE nav_items SET path = ? WHERE id = ?', [next, row.id]);
    } catch (err) {
      // Unique collision: keep existing short path row, drop legacy duplicate.
      if (err && err.code === 'ER_DUP_ENTRY') {
        await db.query('DELETE FROM nav_items WHERE id = ?', [row.id]);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Ensure module shells (restoran, vesti, …) have nav rows with correct short paths + page_id.
 * Fixes older DBs where seed used short paths but admin matched /stranica/:slug.
 */
async function ensureModuleNavItems(db) {
  const slugs = [...MODULE_PAGE_SLUGS];
  if (!slugs.length) return;

  const [pages] = await db.query(
    `SELECT p.id, p.slug, p.title, pt.title AS title_en
     FROM pages p
     LEFT JOIN page_translations pt ON pt.entity_id = p.id AND pt.lang = 'en'
     WHERE p.slug IN (?)`,
    [slugs]
  );

  let changed = false;
  for (const page of pages) {
    const path = pathForPageSlug(page.slug);
    const wrongPath = `/stranica/${page.slug}`;
    const [byPath] = await db.query(
      'SELECT id, page_id, path FROM nav_items WHERE path IN (?, ?) OR page_id = ? LIMIT 1',
      [path, wrongPath, page.id]
    );

    if (byPath.length) {
      const row = byPath[0];
      if (row.path !== path || row.page_id !== page.id) {
        await db.query(
          'UPDATE nav_items SET path = ?, page_id = COALESCE(page_id, ?) WHERE id = ?',
          [path, page.id, row.id]
        );
        changed = true;
      }
      continue;
    }

    const defaults = MODULE_NAV_LABELS[page.slug] || {
      sr: page.title || page.slug,
      en: page.title_en || null,
    };
    const sortSeed = SHORT_PAGE_PATHS[page.slug] ? 50 : 9999;
    await db.query(
      `INSERT INTO nav_items (label_sr, label_en, path, sort_order, is_enabled, page_id)
       VALUES (?, ?, ?, ?, TRUE, ?)`,
      [defaults.sr, defaults.en, path, sortSeed, page.id]
    );
    changed = true;
  }

  if (changed) await renumberAll(db);
}

/**
 * After creating a CMS page, add a menu row (unless slug is an app module shell).
 * Inserted before trailing /istrazi and /kontakt when those exist, then renumbered 1..N.
 */
async function addNavForNewPage(db, { pageId, slug, title, titleEn = null }) {
  if (!shouldAutoAddNavForSlug(slug)) return null;

  const path = pathForPageSlug(slug);
  const en = titleEn && String(titleEn).trim() ? String(titleEn).trim() : null;

  try {
    const [result] = await db.query(
      `INSERT INTO nav_items (label_sr, label_en, path, sort_order, is_enabled, page_id)
       VALUES (?, ?, ?, 9999, TRUE, ?)`,
      [title, en, path, pageId]
    );
    const insertId = result.insertId;

    const [rows] = await db.query('SELECT id, path FROM nav_items ORDER BY sort_order ASC, id ASC');
    const others = rows.filter((row) => row.id !== insertId);
    const trailing = others.filter((row) => row.path === '/istrazi' || row.path === '/kontakt');
    const head = others.filter((row) => row.path !== '/istrazi' && row.path !== '/kontakt');
    const ordered = [...head, { id: insertId }, ...trailing];

    for (let i = 0; i < ordered.length; i += 1) {
      await db.query('UPDATE nav_items SET sort_order = ? WHERE id = ?', [i + 1, ordered[i].id]);
    }

    return insertId;
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      await db.query(
        `UPDATE nav_items SET page_id = COALESCE(page_id, ?), label_sr = ?, label_en = COALESCE(?, label_en)
         WHERE path = ?`,
        [pageId, title, en, path]
      );
      return null;
    }
    throw err;
  }
}

/**
 * Keep menu label in sync when a linked CMS page is renamed.
 * Module shells (pocetna, smestaj, …) keep short menu labels — page title ≠ nav label.
 */
async function syncNavLabelsForPage(db, pageId, { title, titleEn = null, slug = null }) {
  if (slug && MODULE_PAGE_SLUGS.has(String(slug))) return;

  const en = titleEn && String(titleEn).trim() ? String(titleEn).trim() : null;
  await db.query(
    `UPDATE nav_items SET label_sr = ?, label_en = COALESCE(?, label_en) WHERE page_id = ?`,
    [title, en, pageId]
  );

  if (slug) {
    const path = pathForPageSlug(slug);
    await db.query(
      `UPDATE nav_items
       SET label_sr = ?, label_en = COALESCE(?, label_en)
       WHERE page_id IS NULL AND path = ?`,
      [title, en, path]
    );
  }
}

/** Restore home menu label if CMS page title leaked into nav_items. */
async function repairHomeNavLabel(db) {
  const home = MODULE_NAV_LABELS.pocetna;
  const [rows] = await db.query(
    "SELECT id, label_sr FROM nav_items WHERE path = '/' LIMIT 1"
  );
  if (!rows.length) return;

  const current = String(rows[0].label_sr || '').trim();
  if (current === home.sr) return;

  // Page titles are long / multi-word; menu labels stay short (НАСЛОВНА).
  const leaked =
    /\s/.test(current) ||
    current.length > 12 ||
    current === 'ПОЧЕТНА' ||
    current === 'Почетна';
  if (!leaked) return;

  await db.query(
    'UPDATE nav_items SET label_sr = ?, label_en = ? WHERE path = ?',
    [home.sr, home.en, '/']
  );
}

module.exports = {
  addNavForNewPage,
  syncNavLabelsForPage,
  ensureModuleNavItems,
  normalizeStranicaNavPaths,
  repairHomeNavLabel,
  renumberAll,
};
