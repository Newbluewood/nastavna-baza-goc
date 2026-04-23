require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '@NewSQL1',
      database: process.env.DB_NAME || 'defaultdb',
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log("Konektovano na MySQL bazu na:", process.env.DB_HOST || 'localhost');

    // Reset samo tabela vezanih za smeštaj da bi izbegli konflikte pri promeni arhitekture
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('DROP TABLE IF EXISTS inquiries, room_translations, rooms, facility_translations, facilities');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 0. Guests - mora pre inquiries zbog FK
    await connection.query(`
      CREATE TABLE IF NOT EXISTS guests (
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
    `);
    // Dodavanje kolone u slučaju da tabela već postoji
    try {
      await connection.query('ALTER TABLE guests ADD COLUMN vouchers JSON NULL;');
    } catch(err) {
      // Ignorišemo grešku ako kolona već postoji
    }

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

    // 2. Facilities (Objekti/Zgrade)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS facilities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('smestaj', 'proizvodnja', 'infrastruktura', 'rezervat', 'ostalo') DEFAULT 'ostalo',
        name VARCHAR(255) NOT NULL,
        description TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        capacity VARCHAR(100),
        capacity_min INT NULL,
        capacity_max INT NULL,
        cover_image VARCHAR(255),
        floor_plan_image VARCHAR(255),
        location_badges JSON,
        stay_tags JSON
      )
    `);

    // 2.1 Rooms (Sobe u okviru Objekta)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        facility_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity VARCHAR(100),
        capacity_min INT NULL,
        capacity_max INT NULL,
        cover_image VARCHAR(255),
        floor_plan_image VARCHAR(255),
        amenities JSON,
        stay_tags JSON,
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INT DEFAULT 0,
        slug VARCHAR(255)
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

    // 6.5 Inquiries -> target_room_id (Moved up for Foreign Key deps)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(50),
        message TEXT,
        check_in DATE,
        check_out DATE,
        target_room_id INT,
        rejection_reason TEXT NULL,
        status ENUM('novo', 'obradjeno', 'odbijeno', 'otkazano') DEFAULT 'novo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_room_id) REFERENCES rooms(id) ON DELETE SET NULL
      )
    `);

    try {
      await connection.query('ALTER TABLE inquiries ADD COLUMN rejection_reason TEXT NULL');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.warn('Upozorenje: inquiries.rejection_reason kolona nije dodata:', err.message);
      }
    }

    // 7. Reservations (Sa vezom na inquiry i cancel_token za email link)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        inquiry_id INT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        guest_name VARCHAR(255),
        status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'confirmed',
        cancel_token VARCHAR(32) NULL UNIQUE,
        UNIQUE KEY unique_room_dates_status (room_id, start_date, end_date, status),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE SET NULL
      )
    `);

    // Za postojece baze: ukloni stari indeks ako postoji, zatim dodaj novi po statusu.
    try {
      await connection.query('ALTER TABLE reservations DROP INDEX unique_room_dates');
    } catch (err) {
      if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.warn('Upozorenje: stari unique_room_dates indeks nije obrisan:', err.message);
      }
    }

    try {
      await connection.query('ALTER TABLE reservations ADD UNIQUE KEY unique_room_dates_status (room_id, start_date, end_date, status)');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') {
        console.warn('Upozorenje: unique_room_dates_status indeks nije dodat:', err.message);
      }
    }

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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attractions (
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
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attraction_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES attractions(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurant_menu_items (
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
        FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE
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
      CREATE TABLE IF NOT EXISTS room_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        lang VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        UNIQUE KEY lang_entity (entity_id, lang),
        FOREIGN KEY (entity_id) REFERENCES rooms(id) ON DELETE CASCADE
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

    // Facilities (Objekti)
    const [insertedFacilities] = await connection.query(`
      INSERT INTO facilities (type, name, description, capacity, latitude, longitude, cover_image, location_badges) VALUES
      ('smestaj', 'Хотел Пирамида', 'Атрактиван смештајни објекат у облику пирамиде погодан за краће и дуже индивидуалне посете као и организоване групне посете. У саставу хотела налазе се рецепција, caffe bar, ресторан са 100 места, билијар сала и учионица.', '24 лежаја', 43.559095, 20.753930, '/placeholder.jpg', '["Централни објекат", "Близу ресторана"]'),
      ('smestaj', 'Нови Студенац', 'Репрезентативан и највећи објекат (донација ЕУ) погодан за рекреативну наставу и школу у природи. Садржи Конференцијску салу и зелену салу за састанке.', '56 лежајева', 43.559095, 20.753930, '/placeholder.jpg', '["Модеран дизајн", "Брз интернет"]'),
      ('smestaj', 'Вила Власта', 'Вила са прелепом баштом и комфорним собама. Идеално за мирнији одмор у шумском пространству.', 'Deo od 47 лежајева', 43.558636, 20.750094, '/placeholder.jpg', '["Мирна локација", "5 мин до ски стазе"]'),
      ('smestaj', 'Депаданс (Вила Планинка)', 'Депаданс објекат, у саставу комплекса, везан за Вилу Власту са додатним капацитетима.', 'Deo od 47 лежајева', 43.558128, 20.750183, '/placeholder.jpg', '["Повољан смештај"]'),
      ('proizvodnja', 'Пилана', 'Постројење за машинску обраду дрвета.', '', NULL, NULL, '/placeholder.jpg', NULL)
    `);

    // Rooms (Sobe za objekte)
    await connection.query(`
      INSERT INTO rooms (facility_id, name, description, capacity, cover_image, amenities) VALUES
      (1, 'Двокреветна соба', 'Комфорна соба са два лежаја, купатилом и грејањем.', '2 особе', '/placeholder.jpg', '["wifi", "tv", "parking"]'),
      (1, 'Трокреветна соба', 'Пространа соба са три лежаја.', '3 особе', '/placeholder.jpg', '["wifi", "kuhinja"]'),
      (1, 'Четворокреветна соба', 'Идеална соба за породице. Планирајте ваш одмор.', '4 особе', '/placeholder.jpg', '["wifi", "tv"]'),
      
      (2, 'Двокреветна соба', 'Студенац двокреветна соба, потпуно нова и опремљена.', '2 особе', '/placeholder.jpg', '["wifi", "tv", "klima", "parking"]'),
      (2, 'Трокреветна соба', 'Студенац трокреветна соба, погодна за веће групе.', '3 особе', '/placeholder.jpg', '["wifi", "tv"]'),
      (2, 'Једнокреветна соба', 'Савршено за индивидуалне посетиоце.', '1 особа', '/placeholder.jpg', '["wifi"]'),

      (3, 'Породична соба', 'Пространа соба у Вили Власта.', 'Од 1 до 4 особе', '/placeholder.jpg', '["wifi", "kuhinja", "parking"]'),
      (4, 'Стандардна соба', 'Удобан смештај у Депадансу.', 'Од 1 до 4 особе', '/placeholder.jpg', '["parking"]')
    `);

    const defaultAdminHash = await bcrypt.hash('admin123', 10);
    await connection.query(`
      INSERT IGNORE INTO admins (username, password_hash) VALUES ('admin', ?)
    `, [defaultAdminHash]);

    // Slides for Homepage
    await connection.query(`
      INSERT IGNORE INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES
      ('pocetna', 'Наставна База Гоч', 'Динамичан дизајн у природи', '/placeholder.jpg', '/smestaj', 1),
      ('pocetna', 'Смештајни Капацитети', 'Резервишите ваш боравак', '/placeholder.jpg', '/smestaj', 2),
      ('pocetna', 'Студентска Пракса', 'Едукативни програми у шуми', '/placeholder.jpg', '/vesti', 3)
    `);

    // Slides for Smestaj Page
    await connection.query(`
      INSERT IGNORE INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES
      ('smestaj', 'Одмор у природи', 'Најбољи смештај на Гочу', '/placeholder.jpg', '', 1),
      ('smestaj', 'Вила Студенац', 'Комфор и удобност', '/placeholder.jpg', '', 2),
      ('smestaj', 'Хотел Пирамида', 'Ресторан и смештај', '/placeholder.jpg', '', 3)
    `);

    console.log("Ubacujem engleske prevode...");

    await connection.query(`
      INSERT IGNORE INTO facility_translations (entity_id, lang, name, description) VALUES
      (1, 'en', 'Hotel Pyramid', 'Attractive accommodation facility in the shape of a pyramid suitable for individuals and groups. It includes a reception, cafe, restaurant, billiard room and classroom.'),
      (2, 'en', 'New Studenac', 'Representative and the largest facility suitable for recreational and nature schools. It contains a conference hall.'),
      (3, 'en', 'Villa Vlasta', 'Villa with a beautiful garden and comfortable rooms. Ideal for a peaceful forest vacation.'),
      (4, 'en', 'Depadans (Villa Planinka)', 'Annex building linked to Villa Vlasta with extra accommodation capacities.'),
      (5, 'en', 'Sawmill', 'Plant for mechanical wood processing.')
    `);

    await connection.query(`
      INSERT IGNORE INTO room_translations (entity_id, lang, name, description) VALUES
      (1, 'en', 'Double Room', 'Comfortable room with two beds, bathroom, and heating.'),
      (2, 'en', 'Triple Room', 'Spacious room with three beds.'),
      (3, 'en', 'Quadruple Room', 'Ideal room for families.'),
      
      (4, 'en', 'Double Room', 'Studenac double room, brand new and fully equipped.'),
      (5, 'en', 'Triple Room', 'Studenac triple room, suitable for groups.'),
      (6, 'en', 'Single Room', 'Perfect for individual visitors.'),

      (7, 'en', 'Family Room', 'Spacious room in Villa Vlasta.'),
      (8, 'en', 'Standard Room', 'Comfortable stay in Depadans.')
    `);

    // Test Reservations (zauzeti datumi za sobu 1 - Piramida Dvokrevetna)
    await connection.query(`
      INSERT IGNORE INTO reservations (room_id, start_date, end_date, guest_name) VALUES
      (1, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY), 'Test Gost 1'),
      (1, DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 15 DAY), 'Test Gost 2')
    `);

    // Migracija: dodaj cancel_token u reservations ako ne postoji
    try {
      await connection.query(`ALTER TABLE reservations ADD COLUMN cancel_token VARCHAR(32) NULL UNIQUE`);
      console.log("✅ Dodata kolona cancel_token u reservations.");
    } catch (alterErr) {
      if (alterErr.errno !== 1060) throw alterErr;
      console.log("ℹ️ Kolona cancel_token već postoji.");
    }

    // Migracija: dodaj inquiry_id u reservations ako ne postoji
    try {
      await connection.query(`ALTER TABLE reservations ADD COLUMN inquiry_id INT NULL`);
      console.log("✅ Dodata kolona inquiry_id u reservations.");
    } catch (alterErr) {
      if (alterErr.errno !== 1060) throw alterErr;
      console.log("ℹ️ Kolona inquiry_id već postoji.");
    }

    // Migracija: dodaj guest_id u inquiries
    try {
      await connection.query(`ALTER TABLE inquiries ADD COLUMN guest_id INT NULL`);
      console.log("✅ Dodata kolona guest_id u inquiries.");
    } catch (alterErr) {
      if (alterErr.errno !== 1060) throw alterErr;
      console.log("ℹ️ Kolona guest_id već postoji u inquiries.");
    }

    // Migracija: dodaj guest_id u reservations
    try {
      await connection.query(`ALTER TABLE reservations ADD COLUMN guest_id INT NULL`);
      console.log("✅ Dodata kolona guest_id u reservations.");
    } catch (alterErr) {
      if (alterErr.errno !== 1060) throw alterErr;
      console.log("ℹ️ Kolona guest_id već postoji u reservations.");
    }

    console.log("Struktura baze uspešno postavljena!");
    await connection.end();


  } catch (error) {
    console.error("Greška:", error);
  }
}

setup();
