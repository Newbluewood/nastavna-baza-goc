require('dotenv').config()
const mysql = require('mysql2/promise')
const { getMysqlConnectionOptions, redactedMysqlConfig } = require('./lib/mysqlConnectionOptions')

const SHOULD_EXECUTE = process.argv.includes('--execute');

function q(name) {
  return `\`${name}\``;
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1
    `,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function foreignKeyExists(conn, tableName, fkName) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ?
      LIMIT 1
    `,
    [tableName, fkName]
  );
  return rows.length > 0;
}

async function executeOrPrint(conn, sql, description) {
  if (SHOULD_EXECUTE) {
    await conn.query(sql);
    console.log(`EXECUTED: ${description}`);
  } else {
    console.log(`DRY-RUN: ${description}`);
    console.log(`  SQL: ${sql}`);
  }
}

async function ensureTable(conn, tableName, createSql) {
  const exists = await tableExists(conn, tableName);
  if (exists) {
    console.log(`SKIP: table ${tableName} already exists`);
    return;
  }
  await executeOrPrint(conn, createSql, `create table ${tableName}`);
}

async function ensureColumn(conn, tableName, columnName, definitionSql) {
  const hasTable = await tableExists(conn, tableName);
  if (!hasTable) {
    console.log(`SKIP: table ${tableName} does not exist yet (column ${columnName})`);
    return;
  }

  const exists = await columnExists(conn, tableName, columnName);
  if (exists) {
    console.log(`SKIP: column ${tableName}.${columnName} already exists`);
    return;
  }

  await executeOrPrint(
    conn,
    `ALTER TABLE ${q(tableName)} ADD COLUMN ${definitionSql}`,
    `add column ${tableName}.${columnName}`
  );
}

async function ensureIndex(conn, tableName, indexName, sql) {
  const hasTable = await tableExists(conn, tableName);
  if (!hasTable) {
    console.log(`SKIP: table ${tableName} does not exist yet (index ${indexName})`);
    return;
  }

  const exists = await indexExists(conn, tableName, indexName);
  if (exists) {
    console.log(`SKIP: index ${tableName}.${indexName} already exists`);
    return;
  }

  await executeOrPrint(conn, sql, `create index ${tableName}.${indexName}`);
}

async function ensureForeignKey(conn, tableName, fkName, sql) {
  const hasTable = await tableExists(conn, tableName);
  if (!hasTable) {
    console.log(`SKIP: table ${tableName} does not exist yet (fk ${fkName})`);
    return;
  }

  const exists = await foreignKeyExists(conn, tableName, fkName);
  if (exists) {
    console.log(`SKIP: foreign key ${tableName}.${fkName} already exists`);
    return;
  }

  await executeOrPrint(conn, sql, `add foreign key ${tableName}.${fkName}`);
}

async function run() {

  const dbConfig = getMysqlConnectionOptions()
  console.log('DB CONFIG:', redactedMysqlConfig(dbConfig))
  const conn = await mysql.createConnection(dbConfig)

  try {
    console.log('Connected to database.');
    console.log(SHOULD_EXECUTE ? 'MODE: execute' : 'MODE: dry-run');

    await ensureTable(
      conn,
      'guests',
      `
      CREATE TABLE ${q('guests')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50),
        reset_token VARCHAR(64) NULL,
        reset_token_expires DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        vouchers JSON NULL
      )
      `
    );

    await ensureColumn(conn, 'guests', 'vouchers', 'vouchers JSON NULL');

    await ensureColumn(conn, 'inquiries', 'guest_id', 'guest_id INT NULL');
    await ensureColumn(conn, 'inquiries', 'source', "source VARCHAR(32) NOT NULL DEFAULT 'web'");
    await ensureColumn(conn, 'inquiries', 'created_by_admin_id', 'created_by_admin_id INT NULL');
    await ensureColumn(conn, 'inquiries', 'created_by_admin_username', 'created_by_admin_username VARCHAR(100) NULL');
    // Expand status enum for auto-expired pending inquiries
    {
      const [statusCols] = await conn.query("SHOW COLUMNS FROM inquiries LIKE 'status'")
      const statusType = String(statusCols[0]?.Type || '')
      if (statusType.includes("'isteklo'")) {
        console.log('SKIP: inquiries.status already includes isteklo')
      } else {
        await executeOrPrint(
          conn,
          `ALTER TABLE ${q('inquiries')} MODIFY COLUMN ${q('status')} ENUM('novo','obradjeno','odbijeno','otkazano','isteklo') NOT NULL DEFAULT 'novo'`,
          'alter inquiries.status enum (+isteklo)'
        )
      }
    }
    await ensureColumn(conn, 'reservations', 'guest_id', 'guest_id INT NULL');
    await ensureColumn(conn, 'reservations', 'cancel_token', 'cancel_token VARCHAR(32) NULL');
    await ensureColumn(conn, 'reservations', 'inquiry_id', 'inquiry_id INT NULL');
    await ensureColumn(conn, 'news', 'slug', 'slug VARCHAR(255) NULL');
    await ensureColumn(conn, 'news', 'likes', 'likes INT DEFAULT 0');
    await ensureColumn(conn, 'facilities', 'capacity_min', 'capacity_min INT NULL');
    await ensureColumn(conn, 'facilities', 'capacity_max', 'capacity_max INT NULL');
    await ensureColumn(conn, 'facilities', 'stay_tags', 'stay_tags JSON NULL');
    await ensureColumn(conn, 'facilities', 'slug', 'slug VARCHAR(255) NULL');
    await backfillFacilitySlugs(conn);
    await ensureIndex(
      conn,
      'facilities',
      'uq_facilities_slug',
      `CREATE UNIQUE INDEX ${q('uq_facilities_slug')} ON ${q('facilities')} (${q('slug')})`
    );
    await ensureColumn(conn, 'rooms', 'capacity_min', 'capacity_min INT NULL');
    await ensureColumn(conn, 'rooms', 'capacity_max', 'capacity_max INT NULL');
    await ensureColumn(conn, 'rooms', 'stay_tags', 'stay_tags JSON NULL');
    await ensureColumn(conn, 'rooms', 'meal_info', 'meal_info TEXT NULL');
    await ensureColumn(conn, 'room_translations', 'meal_info', 'meal_info TEXT NULL');

    await ensureTable(
      conn,
      'attractions',
      `
      CREATE TABLE ${q('attractions')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        distance_km DECIMAL(6,2) NULL,
        distance_minutes INT NULL,
        family_friendly BOOLEAN DEFAULT TRUE,
        weather_tags JSON NULL,
        season_tags JSON NULL,
        suitable_for JSON NULL,
        location_badges JSON NULL,
        cover_image VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `
    );

    await ensureTable(
      conn,
      'attraction_translations',
      `
      CREATE TABLE ${q('attraction_translations')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        UNIQUE KEY ${q('lang_entity')} (${q('entity_id')}, ${q('lang')}),
        CONSTRAINT ${q('fk_attraction_translations_entity_id')} FOREIGN KEY (${q('entity_id')}) REFERENCES ${q('attractions')} (${q('id')}) ON DELETE CASCADE
      )
      `
    );

    await ensureTable(
      conn,
      'restaurant_menu_items',
      `
      CREATE TABLE ${q('restaurant_menu_items')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attraction_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL DEFAULT 'sr',
        category VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NULL,
        is_available BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ${q('fk_restaurant_menu_items_attraction_id')} FOREIGN KEY (${q('attraction_id')}) REFERENCES ${q('attractions')} (${q('id')}) ON DELETE CASCADE
      )
      `
    );

    await ensureIndex(
      conn,
      'reservations',
      'idx_reservations_room_dates',
      `CREATE INDEX ${q('idx_reservations_room_dates')} ON ${q('reservations')} (${q('room_id')}, ${q('start_date')}, ${q('end_date')})`
    );

    await ensureIndex(
      conn,
      'inquiries',
      'idx_inquiries_guest_id',
      `CREATE INDEX ${q('idx_inquiries_guest_id')} ON ${q('inquiries')} (${q('guest_id')})`
    );

    await ensureIndex(
      conn,
      'news',
      'uq_news_slug',
      `CREATE UNIQUE INDEX ${q('uq_news_slug')} ON ${q('news')} (${q('slug')})`
    );

    await ensureIndex(
      conn,
      'attractions',
      'idx_attractions_type',
      `CREATE INDEX ${q('idx_attractions_type')} ON ${q('attractions')} (${q('type')})`
    );

    await ensureIndex(
      conn,
      'restaurant_menu_items',
      'idx_restaurant_menu_items_attraction_id',
      `CREATE INDEX ${q('idx_restaurant_menu_items_attraction_id')} ON ${q('restaurant_menu_items')} (${q('attraction_id')})`
    );

    await ensureForeignKey(
      conn,
      'inquiries',
      'fk_inquiries_guest_id',
      `ALTER TABLE ${q('inquiries')} ADD CONSTRAINT ${q('fk_inquiries_guest_id')} FOREIGN KEY (${q('guest_id')}) REFERENCES ${q('guests')} (${q('id')}) ON DELETE SET NULL`
    );

    await ensureForeignKey(
      conn,
      'reservations',
      'fk_reservations_guest_id',
      `ALTER TABLE ${q('reservations')} ADD CONSTRAINT ${q('fk_reservations_guest_id')} FOREIGN KEY (${q('guest_id')}) REFERENCES ${q('guests')} (${q('id')}) ON DELETE SET NULL`
    );

    await ensureForeignKey(
      conn,
      'reservations',
      'fk_reservations_inquiry_id',
      `ALTER TABLE ${q('reservations')} ADD CONSTRAINT ${q('fk_reservations_inquiry_id')} FOREIGN KEY (${q('inquiry_id')}) REFERENCES ${q('inquiries')} (${q('id')}) ON DELETE SET NULL`
    );

    await ensureTable(
      conn,
      'chat_messages',
      `
      CREATE TABLE ${q('chat_messages')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guest_id INT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_id VARCHAR(64) NULL,
        meta JSON NULL,
        CONSTRAINT fk_chat_messages_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
      )
      `
    );

    await ensureTable(
      conn,
      'ai_budget_monthly',
      `
      CREATE TABLE ${q('ai_budget_monthly')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        month_key CHAR(7) NOT NULL,
        user_key VARCHAR(64) NOT NULL,
        feature VARCHAR(32) NOT NULL,
        tokens_input BIGINT NOT NULL DEFAULT 0,
        tokens_output BIGINT NOT NULL DEFAULT 0,
        eur_spent DECIMAL(12,6) NOT NULL DEFAULT 0,
        request_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_month_user_feature (month_key, user_key, feature)
      )
      `
    );

    await ensureIndex(
      conn,
      'ai_budget_monthly',
      'idx_ai_budget_month_feature',
      `CREATE INDEX ${q('idx_ai_budget_month_feature')} ON ${q('ai_budget_monthly')} (${q('month_key')}, ${q('feature')})`
    );

    await ensureTable(
      conn,
      'nav_items',
      `
      CREATE TABLE ${q('nav_items')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label_sr VARCHAR(150) NOT NULL,
        label_en VARCHAR(150) NULL,
        path VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        page_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nav_items_path (path),
        CONSTRAINT fk_nav_items_page_id FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
      )
      `
    );

    await seedNavItems(conn);
    if (await tableExists(conn, 'nav_items')) {
      const { repairHomeNavLabel } = require('./services/navSync');
      await repairHomeNavLabel(conn);
      console.log('Checked home nav label (НАСЛОВНА)');
    }

    console.log('Migration plan finished successfully.');
  } finally {
    await conn.end();
  }
}

async function backfillFacilitySlugs(conn) {
  const hasTable = await tableExists(conn, 'facilities');
  if (!hasTable) return;
  if (!(await columnExists(conn, 'facilities', 'slug'))) return;

  const { slugify } = require('./utils/slugify');
  const [rows] = await conn.query(
    `SELECT id, name, slug FROM ${q('facilities')} WHERE slug IS NULL OR slug = ''`
  );
  if (!rows.length) {
    console.log('SKIP: facilities.slug already filled');
    return;
  }

  const [usedRows] = await conn.query(
    `SELECT slug FROM ${q('facilities')} WHERE slug IS NOT NULL AND slug != ''`
  );
  const used = new Set(usedRows.map((r) => r.slug));

  for (const row of rows) {
    let base = slugify(row.name, { fallback: `objekat-${row.id}` });
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    used.add(candidate);
    await executeOrPrint(
      conn,
      `UPDATE ${q('facilities')} SET slug = ${conn.escape(candidate)} WHERE id = ${row.id}`,
      `backfill facility slug ${row.id} → ${candidate}`
    );
  }
}

async function seedNavItems(conn) {
  const hasTable = await tableExists(conn, 'nav_items');
  if (!hasTable) return;

  const [existing] = await conn.query(`SELECT COUNT(*) AS c FROM ${q('nav_items')}`);
  if (existing[0].c > 0) {
    console.log('SKIP: nav_items already seeded');
    return;
  }

  const { pathForPageSlug } = require('./utils/navPaths');

  const core = [
    { slug: 'pocetna', label_sr: 'НАСЛОВНА', label_en: 'HOME', sort_order: 10 },
    { slug: 'smestaj', label_sr: 'СМЕШТАЈ', label_en: 'ACCOMMODATION', sort_order: 20 },
    { slug: 'restoran', label_sr: 'РЕСТОРАН', label_en: 'RESTAURANT', sort_order: 30 },
    { slug: 'vesti', label_sr: 'ВЕСТИ', label_en: 'NEWS', sort_order: 40 },
    { slug: 'istrazi', label_sr: 'ИСТРАЖИ ГОЧ', label_en: 'EXPLORE GOČ', sort_order: 80 },
    { slug: 'kontakt', label_sr: 'КОНТАКТ', label_en: 'CONTACT', sort_order: 90 },
  ];

  for (const item of core) {
    const path = pathForPageSlug(item.slug);
    let pageIdSql = 'NULL';
    const hasPagesTable = await tableExists(conn, 'pages');
    if (hasPagesTable) {
      const [pageRows] = await conn.query(
        `SELECT id FROM ${q('pages')} WHERE slug = ${conn.escape(item.slug)} LIMIT 1`
      );
      if (pageRows.length) pageIdSql = String(pageRows[0].id);
    }
    await executeOrPrint(
      conn,
      `INSERT INTO ${q('nav_items')} (label_sr, label_en, path, sort_order, is_enabled, page_id)
       VALUES (${conn.escape(item.label_sr)}, ${conn.escape(item.label_en)}, ${conn.escape(path)}, ${item.sort_order}, TRUE, ${pageIdSql})`,
      `seed nav_items ${path}`
    );
  }

  const hasPages = await tableExists(conn, 'pages');
  if (!hasPages) return;

  const [pages] = await conn.query(
    `SELECT p.id, p.slug, p.title, pt.title AS title_en
     FROM ${q('pages')} p
     LEFT JOIN ${q('page_translations')} pt ON pt.entity_id = p.id AND pt.lang = 'en'
     WHERE p.slug NOT IN ('pocetna', 'smestaj', 'restoran', 'vesti', 'istrazi', 'kontakt')
     ORDER BY p.id ASC`
  );

  let order = 50;
  for (const page of pages) {
    const path = pathForPageSlug(page.slug);
    const labelEn = page.title_en ? conn.escape(page.title_en) : 'NULL';
    await executeOrPrint(
      conn,
      `INSERT INTO ${q('nav_items')} (label_sr, label_en, path, sort_order, is_enabled, page_id)
       VALUES (${conn.escape(page.title)}, ${labelEn}, ${conn.escape(path)}, ${order}, TRUE, ${page.id})`,
      `seed nav_items page ${page.slug}`
    );
    order += 5;
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
