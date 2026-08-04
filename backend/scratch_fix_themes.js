const mysql = require('mysql2/promise');
const fs = require('fs');
const { getMysqlConnectionOptions } = require('./lib/mysqlConnectionOptions');

async function fixThemes() {
  let connection;
  try {
    connection = await mysql.createConnection(getMysqlConnectionOptions());

    console.log('Connected to database.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(255) NOT NULL UNIQUE,
        icon VARCHAR(255),
        hero_image VARCHAR(255),
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS theme_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        article TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        CONSTRAINT fk_theme_translations_entity_id FOREIGN KEY (entity_id) REFERENCES themes (id) ON DELETE CASCADE
      )
    `);

    const themesData = JSON.parse(fs.readFileSync('./data/goc-themes.json', 'utf-8'));

    for (let i = 0; i < themesData.themes.length; i++) {
        const t = themesData.themes[i];
        
        const [existing] = await connection.query('SELECT id FROM themes WHERE slug = ?', [t.id]);
        let insertId;
        
        if (existing.length === 0) {
            const [result] = await connection.query(
                'INSERT INTO themes (slug, icon, hero_image, display_order) VALUES (?, ?, ?, ?)',
                [t.id, t.icon, t.hero_image, i]
            );
            insertId = result.insertId;
        } else {
            insertId = existing[0].id;
        }
        
        await connection.query('INSERT IGNORE INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)', [insertId, 'sr', t.name, t.article_sr]);
        await connection.query('INSERT IGNORE INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)', [insertId, 'en', t.name, t.article_en]);
    }

    console.log('Themes created and populated successfully!');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

fixThemes();
