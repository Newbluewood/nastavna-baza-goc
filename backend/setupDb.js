require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '@NewSQL1',
      database: process.env.DB_NAME || 'baza_goc',
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log("Konektovano na MySQL bazu na:", process.env.DB_HOST || 'localhost');

    // Za Aiven cloud se po defaultu nalazimo unutar 'defaultdb', stoga uklanjamo DROP i CREATE DATABASE linije da ne padnemo na zabranama permisija
    // await connection.query('DROP DATABASE IF EXISTS baza_goc');
    // await connection.query('CREATE DATABASE baza_goc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    // await connection.changeUser({ database: process.env.DB_NAME || 'baza_goc' });

    // 1. Pages
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT
      )
    `);

    // 1.5 Admins
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Facilities
    await connection.query(`
      CREATE TABLE IF NOT EXISTS facilities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('smestaj', 'proizvodnja', 'infrastruktura', 'rezervat', 'ostalo') DEFAULT 'ostalo',
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity VARCHAR(100),
        cover_image VARCHAR(255),
        floor_plan_image VARCHAR(255)
      )
    `);

    // 3. Projects
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(100),
        start_date DATE
      )
    `);

    // 4. Staff
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        contact_email VARCHAR(255),
        photo_url VARCHAR(255)
      )
    `);

    // 5. News
    await connection.query(`
      CREATE TABLE IF NOT EXISTS news (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        excerpt TEXT,
        content TEXT,
        cover_image VARCHAR(255),
        related_entity_type VARCHAR(50),
        related_entity_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Hero Slides
    await connection.query(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page_slug VARCHAR(100) DEFAULT 'pocetna',
        title VARCHAR(255),
        subtitle VARCHAR(255),
        image_url VARCHAR(255) NOT NULL,
        target_link VARCHAR(255),
        display_order INT DEFAULT 0
      )
    `);

    // 7. Inquiries
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(50),
        message TEXT NOT NULL,
        target_facility_id INT,
        status ENUM('novo', 'obradjeno', 'odbijeno') DEFAULT 'novo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_facility_id) REFERENCES facilities(id) ON DELETE SET NULL
      )
    `);

    // 8. Media Gallery
    await connection.query(`
      CREATE TABLE IF NOT EXISTS media_gallery (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        caption VARCHAR(255),
        sort_order INT DEFAULT 0
      )
    `);

    // 9. Translations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS page_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES pages(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS facility_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES facilities(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS hero_slides_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        title VARCHAR(255),
        subtitle VARCHAR(255),
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES hero_slides(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS news_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        title VARCHAR(255),
        excerpt TEXT,
        content TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES news(id) ON DELETE CASCADE
      )
    `);

    console.log("Ubacujem inicijalne podatke...");
    
    // Pages
    await connection.query(`
      INSERT IGNORE INTO pages (slug, title, content) VALUES
      ('pocetna', 'Наставна база Гоч', '<p>Ово је експериментални бекенд са новом архитектуром базе података. Спремни смо за вести, пројекте и резервације!</p>'),
      ('smestaj', 'Смештајни капацитети', '<p>Наставна база Гоч поседује разноврсне смештајне објекте намењене студентима, професорима и туристима.</p>')
    `);

    await connection.query(`
      INSERT IGNORE INTO facilities (type, name, description, capacity, cover_image) VALUES
      ('smestaj', 'Пирамида', 'Атрактиван смештајни објекат у облику пирамиде погодан за групе.', '30 лежајева', '/placeholder.jpg'),
      ('smestaj', 'Вила Студенац', 'Репрезентативан објекат намењен наставном особљу са комплетним комфором.', '10 лежајева', '/placeholder.jpg'),
      ('smestaj', 'Студентски павиљон', 'Велики објекат намењен смештају студената током праксе.', '120 лежајева', '/placeholder.jpg'),
      ('proizvodnja', 'Пилана', 'Постројење за машинску обраду дрвета.', '', '/placeholder.jpg')
    `);

    const defaultAdminHash = await bcrypt.hash('admin123', 10);
    await connection.query(`
      INSERT IGNORE INTO admins (username, password_hash) VALUES ('admin', ?)
    `, [defaultAdminHash]);

    // Slides for Homepage
    await connection.query(`
      INSERT IGNORE INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES
      ('pocetna', 'Фабрика Дрвета', 'Унапређена производња', '/placeholder.jpg', '/proizvodnja', 1),
      ('pocetna', 'Смештај Клуб', 'Резервишите ваш боравак', '/placeholder.jpg', '/smestaj', 2),
      ('pocetna', 'Природни Резерват', 'Гоч - Гвоздац', '/placeholder.jpg', '/rezervat', 3)
    `);

    // Slides for Smestaj Page
    await connection.query(`
      INSERT IGNORE INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES
      ('smestaj', 'Одмор у природи', 'Најбољи смештај на Гочу', '/placeholder.jpg', '', 1),
      ('smestaj', 'Вила Студенац', 'Комфор и удобност', '/placeholder.jpg', '', 2)
    `);

    // News
    await connection.query(`
      INSERT IGNORE INTO news (title, excerpt, content, cover_image) VALUES
      ('Нови пројекат пошумљавања', 'Почела је акција посађивања нових садница...', 'Пун текст вести...', '/placeholder.jpg'),
      ('Отворена нова сушара', 'У наставној бази пуштена у рад савремена сушара.', 'Пун текст вести...', '/placeholder.jpg'),
      ('Посета студената из иностранства', 'Студенти из Немачке обишли су печењару и пилану.', 'Пун текст вести...', '/placeholder.jpg')
    `);

    // Galerija
    await connection.query(`
      INSERT IGNORE INTO media_gallery (entity_type, entity_id, image_url, sort_order) VALUES
      ('page', 1, '/placeholder.jpg', 1),
      ('page', 1, '/placeholder.jpg', 2),
      ('page', 1, '/placeholder.jpg', 3)
    `);

    console.log("Ubacujem engleske prevode...");

    await connection.query(`
      INSERT IGNORE INTO page_translations (entity_id, lang, title, content) VALUES
      (1, 'en', 'Goč Training Base', '<p>This is an experimental backend with a new database architecture. We are ready for news, projects, and reservations!</p>'),
      (2, 'en', 'Accommodation Facilities', '<p>The Goč training base has various accommodation facilities intended for students, professors, and tourists.</p>')
    `);

    await connection.query(`
      INSERT IGNORE INTO facility_translations (entity_id, lang, name, description) VALUES
      (1, 'en', 'Pyramid', 'Attractive accommodation facility in the shape of a pyramid suitable for groups.'),
      (2, 'en', 'Villa Studenac', 'Representative facility intended for teaching staff with full comfort.'),
      (3, 'en', 'Student Pavilion', 'Large facility intended for student accommodation during practical training.'),
      (4, 'en', 'Sawmill', 'Plant for mechanical wood processing.')
    `);

    await connection.query(`
      INSERT IGNORE INTO hero_slides_translations (entity_id, lang, title, subtitle) VALUES
      (1, 'en', 'Wood Factory', 'Upgraded production'),
      (2, 'en', 'Accommodation Club', 'Book your stay'),
      (3, 'en', 'Nature Reserve', 'Goč - Gvozdac'),
      (4, 'en', 'Vacation in Nature', 'The best accommodation on Goč'),
      (5, 'en', 'Villa Studenac', 'Comfort and coziness')
    `);

    await connection.query(`
      INSERT IGNORE INTO news_translations (entity_id, lang, title, excerpt, content) VALUES
      (1, 'en', 'New Afforestation Project', 'The action of planting new seedlings has started...', 'Full news text...'),
      (2, 'en', 'New Dryer Opened', 'A modern dryer was put into operation at the training base.', 'Full news text...'),
      (3, 'en', 'Visit of Foreign Students', 'Students from Germany visited the bakery and the sawmill.', 'Full news text...')
    `);

    console.log("Struktura baze uspešno postavljena!");
    await connection.end();
  } catch (error) {
    console.error("Greška:", error);
  }
}

setup();
