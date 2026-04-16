require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/api/home', async (req, res) => {
  try {
    const db = require('./db');
    const lang = req.query.lang || 'sr';
    
    // Dohvata tekstualni opis pocetne
    const [pageRows] = await db.query(`
      SELECT p.id, p.slug, 
        COALESCE(t.title, p.title) as title, 
        COALESCE(t.content, p.content) as content
      FROM pages p
      LEFT JOIN page_translations t ON t.entity_id = p.id AND t.lang = ?
      WHERE p.slug = 'pocetna' LIMIT 1
    `, [lang]);
    const pageData = pageRows[0] || {};

    // Dohvata slajdere za hero
    const [slides] = await db.query(`
      SELECT h.image_url, h.target_link,
        COALESCE(t.title, h.title) as title,
        COALESCE(t.subtitle, h.subtitle) as subtitle
      FROM hero_slides h
      LEFT JOIN hero_slides_translations t ON t.entity_id = h.id AND t.lang = ?
      WHERE h.page_slug = 'pocetna' ORDER BY h.display_order ASC
    `, [lang]);

    // Dohvata najnovije vesti (povećano sa 3 na 10 da bio karusel bio puniji)
    const [news] = await db.query(`
      SELECT n.id, n.slug, n.cover_image, n.created_at,
        COALESCE(t.title, n.title) as title,
        COALESCE(t.excerpt, n.excerpt) as excerpt,
        COALESCE(t.content, n.content) as content
      FROM news n
      LEFT JOIN news_translations t ON t.entity_id = n.id AND t.lang = ?
      ORDER BY n.created_at DESC LIMIT 10
    `, [lang]);

    // Dohvata galeriju pocetne
    const [gallery] = await db.query("SELECT image_url as url FROM media_gallery WHERE entity_type = 'page' AND entity_id = ? ORDER BY sort_order ASC", [pageData.id || 1]);

    const data = {
      pageTitle: pageData.title || "",
      textContent: pageData.content || "",
      slides: slides,
      news: news,
      galleryItems: gallery
    };

    res.json(data);
  } catch (error) {
    console.error("Greška pri dohvatanju podataka:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/smestaj', async (req, res) => {
  try {
    const db = require('./db');
    const lang = req.query.lang || 'sr';
    
    // Dohvata opis za stranicu smestaj
    const [pageRows] = await db.query(`
      SELECT p.id, p.slug,
        COALESCE(t.title, p.title) as title,
        COALESCE(t.content, p.content) as content
      FROM pages p
      LEFT JOIN page_translations t ON t.entity_id = p.id AND t.lang = ?
      WHERE p.slug = 'smestaj' LIMIT 1
    `, [lang]);
    const pageData = pageRows[0] || {};

    // Dohvata slajdere
    const [slides] = await db.query(`
      SELECT h.image_url, h.target_link,
        COALESCE(t.title, h.title) as title,
        COALESCE(t.subtitle, h.subtitle) as subtitle
      FROM hero_slides h
      LEFT JOIN hero_slides_translations t ON t.entity_id = h.id AND t.lang = ?
      WHERE h.page_slug = 'smestaj' ORDER BY h.display_order ASC
    `, [lang]);

    // Dohvata sve smestajne objekte (Facilities)
    const [facilities] = await db.query(`
      SELECT f.id, f.type, f.capacity, f.latitude, f.longitude, f.cover_image, f.floor_plan_image, f.location_badges,
        COALESCE(t.name, f.name) as name,
        COALESCE(t.description, f.description) as description
      FROM facilities f
      LEFT JOIN facility_translations t ON t.entity_id = f.id AND t.lang = ?
      WHERE f.type = 'smestaj'
    `, [lang]);

    // Opciono: učitaj galerije za svaki smeštaj
    for (let facility of facilities) {
        const [gal] = await db.query(
            "SELECT image_url, caption FROM media_gallery WHERE entity_type='facility' AND entity_id=? ORDER BY sort_order ASC", 
            [facility.id]
        );
        facility.gallery = gal || [];
    }

    const data = {
      pageTitle: pageData.title || (lang === 'en' ? "Accommodation" : "Смештај"),
      textContent: pageData.content || "",
      slides: slides,
      facilities: facilities
    };

    res.json(data);
  } catch (error) {
    console.error("Greška pri dohvatanju smeštaja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/smestaj/:id', async (req, res) => {
  try {
    const db = require('./db');
    const lang = req.query.lang || 'sr';
    const { id } = req.params;

    // Dohvati objekat
    const [facilityRows] = await db.query(`
      SELECT f.id, f.type, f.capacity, f.cover_image, f.floor_plan_image,
        COALESCE(t.name, f.name) as name,
        COALESCE(t.description, f.description) as description
      FROM facilities f
      LEFT JOIN facility_translations t ON t.entity_id = f.id AND t.lang = ?
      WHERE f.id = ? AND f.type = 'smestaj'
    `, [lang, id]);

    if (facilityRows.length === 0) return res.status(404).json({ error: "Objekat not found" });
    const building = facilityRows[0];

    // Galerija Objekta
    const [buildingGallery] = await db.query(
        "SELECT image_url, caption FROM media_gallery WHERE entity_type='facility' AND entity_id=? ORDER BY sort_order ASC", 
        [building.id]
    );
    building.gallery = buildingGallery || [];

    // Dohvati sobe za ovaj objekat
    const [rooms] = await db.query(`
      SELECT r.id, r.facility_id, r.capacity, r.cover_image, r.floor_plan_image, r.amenities,
        COALESCE(t.name, r.name) as name,
        COALESCE(t.description, r.description) as description
      FROM rooms r
      LEFT JOIN room_translations t ON t.entity_id = r.id AND t.lang = ?
      WHERE r.facility_id = ?
    `, [lang, id]);

    // Galerija po sobi
    for (let room of rooms) {
      const [roomGallery] = await db.query(
        "SELECT image_url, caption FROM media_gallery WHERE entity_type='room' AND entity_id=? ORDER BY sort_order ASC",
        [room.id]
      );
      room.gallery = roomGallery || [];
    }

    building.rooms = rooms;

    res.json(building);
  } catch (error) {
    console.error("Greška pri dohvatanju soba objekta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/rooms/:id/availability', async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    
    // Dohvata potvrđene rezervacije (status = 'confirmed') za odabranu sobu
    const [reservations] = await db.query(`
      SELECT start_date, end_date 
      FROM reservations 
      WHERE room_id = ? AND status = 'confirmed' AND end_date >= CURRENT_DATE
    `, [id]);
    
    res.json(reservations);
  } catch (error) {
    console.error("Greška pri dohvatanju rezervacija:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/inquiries', async (req, res) => {
  try {
    const db = require('./db');
    const { sender_name, email, phone, message, check_in, check_out, target_room_id } = req.body;
    
    if (!sender_name || (!message && !check_in)) {
      return res.status(400).json({ error: "Ime i datumi (ili poruka) su obavezni." });
    }

    const query = `
      INSERT INTO inquiries (sender_name, email, phone, message, check_in, check_out, target_room_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.query(query, [sender_name, email || null, phone || null, message || null, check_in || null, check_out || null, target_room_id || null]);
    
    res.json({ success: true, message: "Vaš upit je uspešno poslat." });
  } catch (error) {
    console.error("Greška pri čuvanju upita/rezervacije:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ADMIN LOGIN
app.post('/api/admin/login', async (req, res) => {
  try {
    const db = require('./db');
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    
    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // Use 7d to persist session
    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET || 'baza_goc_super_secret_key_123', { expiresIn: '7d' });
    
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN TRANSLATE (DeepL)
app.post('/api/admin/translate', authMiddleware, async (req, res) => {
  try {
    const { text, target_lang } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey || apiKey === 'your_deepl_api_key_here') {
      // Mocked response if API key is not yet set
      return res.json({ translated_text: `[EN: ${text}]` });
    }

    // Direct fetch to DeepL API
    const url = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
    
    const deeplRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: (target_lang || 'EN').toUpperCase()
      })
    });

    const data = await deeplRes.json();
    if (!deeplRes.ok) {
        console.error("DeepL error", data);
        return res.status(500).json({ error: "Translation API failed" });
    }

    res.json({ translated_text: data.translations[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET NEWS (Public)
app.get('/api/news', async (req, res) => {
  try {
    const db = require('./db');
    const lang = req.query.lang || 'sr';
    const [news] = await db.query(`
      SELECT n.id, n.slug, n.cover_image, n.created_at, n.likes,
        COALESCE(t.title, n.title) as title,
        COALESCE(t.excerpt, n.excerpt) as excerpt,
        COALESCE(t.content, n.content) as content
      FROM news n
      LEFT JOIN news_translations t ON t.entity_id = n.id AND t.lang = ?
      ORDER BY n.created_at DESC
    `, [lang]);
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET SINGLE NEWS (Public)
app.get('/api/news/:id', async (req, res) => {
  try {
    const db = require('./db');
    const lang = req.query.lang || 'sr';
    const { id } = req.params;

    const [newsRows] = await db.query(`
      SELECT n.id, n.slug, n.cover_image, n.created_at, n.likes,
        COALESCE(t.title, n.title) as title,
        COALESCE(t.excerpt, n.excerpt) as excerpt,
        COALESCE(t.content, n.content) as content
      FROM news n
      LEFT JOIN news_translations t ON t.entity_id = n.id AND t.lang = ?
      WHERE n.id = ? OR n.slug = ?
    `, [lang, id, id]);

    if (newsRows.length === 0) return res.status(404).json({ error: "Vesti not found" });
    const newsItem = newsRows[0];

    const [gallery] = await db.query(`
      SELECT image_url, caption
      FROM media_gallery
      WHERE entity_type = 'news' AND entity_id = ?
      ORDER BY sort_order ASC
    `, [newsItem.id]);
    
    newsItem.gallery = gallery;

    res.json(newsItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LIKE NEWS (Public)
app.post('/api/news/:id/like', async (req, res) => {
    try {
        const db = require('./db');
        const { id } = req.params;
        await db.query('UPDATE news SET likes = likes + 1 WHERE id = ?', [id]);
        
        const [rows] = await db.query('SELECT likes FROM news WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json({ likes: rows[0].likes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ADMIN POST NEWS (Protected)
app.post('/api/admin/news', authMiddleware, async (req, res) => {
    try {
        const db = require('./db');
        const { title, excerpt, content, cover_image, title_en, excerpt_en, content_en } = req.body;

        if (!title || !title_en) return res.status(400).json({ error: "Title and Title_EN are required to publish" });

        // Generate slug from English or Serbian title (clean lowercase letters)
        let baseSlug = title_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!baseSlug) baseSlug = 'news';
        
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
            const [existing] = await db.query("SELECT id FROM news WHERE slug = ?", [slug]);
            if (existing.length === 0) break;
            slug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        const [result] = await db.query(
            "INSERT INTO news (slug, title, excerpt, content, cover_image) VALUES (?, ?, ?, ?, ?)",
            [slug, title, excerpt, content, cover_image]
        );
        const newsId = result.insertId;

        await db.query(
            "INSERT INTO news_translations (entity_id, lang, title, excerpt, content) VALUES (?, 'en', ?, ?, ?)",
            [newsId, title_en, excerpt_en, content_en]
        );

        res.json({ success: true, id: newsId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===== ADMIN: UPRAVLJANJE UPITIMA / REZERVACIJAMA =====

// GET svi upiti (Admin Only)
app.get('/api/admin/inquiries', authMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const [rows] = await db.query(`
      SELECT 
        i.id, i.sender_name, i.email, i.phone, i.message,
        i.check_in, i.check_out, i.status, i.created_at,
        r.name AS room_name,
        f.name AS facility_name
      FROM inquiries i
      LEFT JOIN rooms r ON r.id = i.target_room_id
      LEFT JOIN facilities f ON f.id = r.facility_id
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST promeni status upita (Admin Only)
// status moze biti: 'obradjeno', 'odbijeno', 'otkazano'
app.post('/api/admin/inquiries/:id/status', authMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['obradjeno', 'odbijeno', 'otkazano'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Nevalidan status.' });
    }

    // Dohvati upit
    const [inquiryRows] = await db.query('SELECT * FROM inquiries WHERE id = ?', [id]);
    if (inquiryRows.length === 0) return res.status(404).json({ error: 'Upit nije pronađen.' });
    const inquiry = inquiryRows[0];

    if (status === 'obradjeno') {
      // Automatski kreira rezervaciju ako jos ne postoji
      const [existingRes] = await db.query('SELECT id FROM reservations WHERE inquiry_id = ?', [id]);
      if (existingRes.length === 0 && inquiry.target_room_id && inquiry.check_in && inquiry.check_out) {
        await db.query(
          `INSERT INTO reservations (room_id, inquiry_id, start_date, end_date, guest_name, status)
           VALUES (?, ?, ?, ?, ?, 'confirmed')`,
          [inquiry.target_room_id, id, inquiry.check_in, inquiry.check_out, inquiry.sender_name]
        );
      }
    }

    if (status === 'otkazano') {
      // Obriši rezervaciju vezanu za ovaj upit (oslobodi datume)
      await db.query("UPDATE reservations SET status = 'cancelled' WHERE inquiry_id = ?", [id]);
    }

    // Ažuriraj status upita
    await db.query('UPDATE inquiries SET status = ? WHERE id = ?', [status, id]);

    res.json({ success: true, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
