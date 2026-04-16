require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const authMiddleware = require('./auth');
const { guestAuthMiddleware, signGuestToken } = require('./guestAuth');
const { sendEmail, templates } = require('./email');

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
    
    // DATE_FORMAT vraca string 'YYYY-MM-DD' umesto JS Date objekta
    // cime se izbegava timezone pomeraj na frontendu
    const [reservations] = await db.query(`
      SELECT 
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date
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

    // ===== AUTO GUEST ACCOUNT =====
    let guestId = null;
    let isNewGuest = false;

    if (email) {
      const [existingGuests] = await db.query('SELECT id FROM guests WHERE email = ?', [email]);
      
      if (existingGuests.length > 0) {
        guestId = existingGuests[0].id;
        sendEmail(email, templates.guestExists({ name: sender_name })).catch(console.error);
      } else {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const hash = await bcrypt.hash(tempPassword, 10);
        const [guestResult] = await db.query(
          'INSERT INTO guests (email, password_hash, name, phone) VALUES (?, ?, ?, ?)',
          [email, hash, sender_name, phone || null]
        );
        guestId = guestResult.insertId;
        isNewGuest = true;
        sendEmail(email, templates.guestCreated({ name: sender_name, email, password: tempPassword })).catch(console.error);
      }
    }

    await db.query(
      `INSERT INTO inquiries (sender_name, email, phone, message, check_in, check_out, target_room_id, guest_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sender_name, email || null, phone || null, message || null, check_in || null, check_out || null, target_room_id || null, guestId]
    );

    if (email && !isNewGuest) {
      sendEmail(email, templates.inquiryReceived({ name: sender_name })).catch(console.error);
    }
    
    res.json({ success: true, message: "Vaš upit je uspešno poslat.", newAccount: isNewGuest });
  } catch (error) {
    console.error("Greška pri čuvanju upita/rezervacije:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
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
app.post('/api/admin/inquiries/:id/status', authMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['obradjeno', 'odbijeno', 'otkazano'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Nevalidan status.' });
    }

    // Dohvati upit sa formatiranim datumima (bez timezone pomaka)
    const [inquiryRows] = await db.query(`
      SELECT 
        id, sender_name, email, phone, target_room_id, status,
        DATE_FORMAT(check_in, '%Y-%m-%d') as check_in,
        DATE_FORMAT(check_out, '%Y-%m-%d') as check_out
      FROM inquiries WHERE id = ?
    `, [id]);

    if (inquiryRows.length === 0) {
      return res.status(404).json({ error: 'Upit nije pronađen.' });
    }
    const inquiry = inquiryRows[0];

    if (status === 'obradjeno') {
      const [existingRes] = await db.query(
        'SELECT id FROM reservations WHERE room_id = ? AND start_date = ? AND end_date = ?',
        [inquiry.target_room_id, inquiry.check_in, inquiry.check_out]
      );

      if (existingRes.length === 0 && inquiry.target_room_id && inquiry.check_in && inquiry.check_out) {
        const cancelToken = uuidv4().replace(/-/g, '').substring(0, 16);
        try {
          await db.query(
            `INSERT INTO reservations (room_id, inquiry_id, start_date, end_date, guest_name, status, cancel_token)
             VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`,
            [inquiry.target_room_id, id, inquiry.check_in, inquiry.check_out, inquiry.sender_name, cancelToken]
          );
        } catch (insertErr) {
          console.warn('Fallback INSERT bez inquiry_id/cancel_token:', insertErr.message);
          await db.query(
            `INSERT INTO reservations (room_id, start_date, end_date, guest_name, status)
             VALUES (?, ?, ?, ?, 'confirmed')`,
            [inquiry.target_room_id, inquiry.check_in, inquiry.check_out, inquiry.sender_name]
          );
        }

        // Dohvati podatke o sobi i zgradi za email
        if (inquiry.email) {
          const [roomRows] = await db.query(`
            SELECT r.name as room_name, f.name as facility_name
            FROM rooms r JOIN facilities f ON f.id = r.facility_id
            WHERE r.id = ?
          `, [inquiry.target_room_id]);
          const roomData = roomRows[0] || {};

          sendEmail(inquiry.email, templates.approved({
            name: inquiry.sender_name,
            facility: roomData.facility_name || 'Nastavna baza Goč',
            room: roomData.room_name || 'Smestaj',
            checkIn: inquiry.check_in,
            checkOut: inquiry.check_out,
            cancelToken
          })).catch(console.error);
        }
      }
    }

    if (status === 'odbijeno') {
      if (inquiry.email) {
        sendEmail(inquiry.email, templates.rejected({ name: inquiry.sender_name })).catch(console.error);
      }
    }

    if (status === 'otkazano') {
      try {
        await db.query("UPDATE reservations SET status = 'cancelled' WHERE inquiry_id = ?", [id]);
      } catch (cancelErr) {
        console.warn('Fallback cancel:', cancelErr.message);
        await db.query(
          "UPDATE reservations SET status = 'cancelled' WHERE room_id = ? AND start_date = ? AND end_date = ?",
          [inquiry.target_room_id, inquiry.check_in, inquiry.check_out]
        );
      }
    }

    await db.query('UPDATE inquiries SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, status });
  } catch (err) {
    console.error('Greška pri promeni statusa upita:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ===== JAVNI CANCEL ENDPOINT (link iz emaila) =====
app.get('/api/cancel/:token', async (req, res) => {
  try {
    const db = require('./db');
    const { token } = req.params;

    const [rows] = await db.query(`
      SELECT r.id, r.guest_name, r.start_date, r.end_date, r.status, r.cancel_token,
        DATE_FORMAT(r.start_date, '%Y-%m-%d') as check_in,
        DATE_FORMAT(r.end_date, '%Y-%m-%d') as check_out,
        ro.name as room_name, f.name as facility_name,
        i.email
      FROM reservations r
      LEFT JOIN rooms ro ON ro.id = r.room_id
      LEFT JOIN facilities f ON f.id = ro.facility_id
      LEFT JOIN inquiries i ON i.id = r.inquiry_id
      WHERE r.cancel_token = ?
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rezervacija nije pronađena.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cancel/:token', async (req, res) => {
  try {
    const db = require('./db');
    const { token } = req.params;

    const [rows] = await db.query(`
      SELECT r.*, 
        DATE_FORMAT(r.start_date, '%Y-%m-%d') as check_in,
        DATE_FORMAT(r.end_date, '%Y-%m-%d') as check_out,
        ro.name as room_name, f.name as facility_name,
        i.email
      FROM reservations r
      LEFT JOIN rooms ro ON ro.id = r.room_id
      LEFT JOIN facilities f ON f.id = ro.facility_id
      LEFT JOIN inquiries i ON i.id = r.inquiry_id
      WHERE r.cancel_token = ?
    `, [token]);

    if (rows.length === 0) return res.status(404).json({ error: 'Rezervacija nije pronađena.' });
    const reservation = rows[0];

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Rezervacija je već otkazana.' });
    }

    // Provjera 7-dnevnog roka
    const checkIn = new Date(reservation.check_in + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const daysUntilCheckin = Math.round((checkIn - today) / (1000 * 60 * 60 * 24));

    if (daysUntilCheckin < 7) {
      return res.status(400).json({
        error: `Otkazivanje nije moguće. Do dolaska je manje od 7 dana (${daysUntilCheckin} dana).`
      });
    }

    // Otkaži rezervaciju
    await db.query("UPDATE reservations SET status = 'cancelled' WHERE cancel_token = ?", [token]);
    // Ažuriraj upit
    if (reservation.inquiry_id) {
      await db.query("UPDATE inquiries SET status = 'otkazano' WHERE id = ?", [reservation.inquiry_id]);
    }

    // Pošalji email potvrdu otkazivanja
    if (reservation.email) {
      sendEmail(reservation.email, templates.cancelConfirmed({
        name: reservation.guest_name,
        facility: reservation.facility_name,
        room: reservation.room_name,
        checkIn: reservation.check_in,
        checkOut: reservation.check_out
      })).catch(console.error);
    }

    res.json({ success: true, message: 'Rezervacija uspešno otkazana.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADMIN CRM: UPRAVLJANJE GOSTIMA I VAUČERIMA =====

// Lista svih gostiju i statistika dolazaka
app.get('/api/admin/guests', authMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const [guests] = await db.query(`
      SELECT g.id, g.name, g.email, g.phone, g.vouchers, g.created_at,
        COUNT(r.id) as reservation_count
      FROM guests g
      LEFT JOIN reservations r ON r.guest_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    
    // Parse vouchers JSON ako je string (zavisno od DB drajvera)
    const result = guests.map(g => ({
      ...g,
      vouchers: typeof g.vouchers === 'string' ? JSON.parse(g.vouchers) : (g.vouchers || [])
    }));
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dodela vaučera određenom gostu
app.post('/api/admin/guests/:id/vouchers', authMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { title, description } = req.body;
    
    if (!title) return res.status(400).json({ error: 'Naslov vaučera je obavezan.' });
    
    const [rows] = await db.query('SELECT vouchers FROM guests WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Gost nije pronađen.' });
    
    let currentVouchers = [];
    try {
      if (rows[0].vouchers) {
        currentVouchers = typeof rows[0].vouchers === 'string' ? JSON.parse(rows[0].vouchers) : rows[0].vouchers;
      }
    } catch(e) {}
    
    const newVoucher = {
      id: uuidv4().substring(0, 8),
      title,
      description: description || '',
      status: 'active', // active, redeemed
      created_at: new Date().toISOString()
    };
    
    currentVouchers.push(newVoucher);
    
    await db.query('UPDATE guests SET vouchers = ? WHERE id = ?', [JSON.stringify(currentVouchers), id]);
    
    res.json({ success: true, voucher: newVoucher });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ===== GUEST RUTE =====

app.post('/api/guests/login', async (req, res) => {
  try {
    const db = require('./db');
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email i lozinka su obavezni.' });
    const [rows] = await db.query('SELECT * FROM guests WHERE email = ? AND is_active = TRUE', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
    const token = signGuestToken(rows[0]);
    res.json({ token, name: rows[0].name, email: rows[0].email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guests/me', guestAuthMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const [rows] = await db.query('SELECT id, name, email, phone, created_at, vouchers FROM guests WHERE id = ?', [req.guest.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Nalog nije pronađen.' });
    
    const guestData = rows[0];
    guestData.vouchers = typeof guestData.vouchers === 'string' ? JSON.parse(guestData.vouchers) : (guestData.vouchers || []);
    
    res.json(guestData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Iskorišćavanje (Redeem) vaučera od strane Gosta
app.post('/api/guests/vouchers/:voucherId/redeem', guestAuthMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const voucherId = req.params.voucherId;
    
    const [rows] = await db.query('SELECT vouchers FROM guests WHERE id = ?', [req.guest.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Gost nije pronađen.' });
    
    let currentVouchers = [];
    try {
      if (rows[0].vouchers) {
        currentVouchers = typeof rows[0].vouchers === 'string' ? JSON.parse(rows[0].vouchers) : rows[0].vouchers;
      }
    } catch(e) {}
    
    const voucherIndex = currentVouchers.findIndex(v => v.id === voucherId);
    if (voucherIndex === -1) return res.status(404).json({ error: 'Vaučer nije pronađen.' });
    if (currentVouchers[voucherIndex].status === 'redeemed') {
      return res.status(400).json({ error: 'Vaučer je već iskorišćen.' });
    }
    
    currentVouchers[voucherIndex].status = 'redeemed';
    currentVouchers[voucherIndex].redeemed_at = new Date().toISOString();
    
    await db.query('UPDATE guests SET vouchers = ? WHERE id = ?', [JSON.stringify(currentVouchers), req.guest.id]);
    
    res.json({ success: true, vouchers: currentVouchers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guests/reservations', guestAuthMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const [rows] = await db.query(`
      SELECT i.id as inquiry_id, i.status as inquiry_status, i.created_at,
        DATE_FORMAT(i.check_in, '%Y-%m-%d') as check_in,
        DATE_FORMAT(i.check_out, '%Y-%m-%d') as check_out,
        r.name as room_name, f.name as facility_name,
        res.id as reservation_id, res.status as reservation_status,
        res.cancel_token,
        DATE_FORMAT(res.start_date, '%Y-%m-%d') as res_start,
        DATE_FORMAT(res.end_date, '%Y-%m-%d') as res_end
      FROM inquiries i
      LEFT JOIN rooms r ON r.id = i.target_room_id
      LEFT JOIN facilities f ON f.id = r.facility_id
      LEFT JOIN reservations res ON res.inquiry_id = i.id
      WHERE i.guest_id = ?
      ORDER BY i.created_at DESC
    `, [req.guest.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/guests/password', guestAuthMiddleware, async (req, res) => {
  try {
    const db = require('./db');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Stara i nova lozinka su obavezne.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Nova lozinka mora imati najmanje 6 znakova.' });
    const [rows] = await db.query('SELECT password_hash FROM guests WHERE id = ?', [req.guest.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Trenutna lozinka nije ispravna.' });
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE guests SET password_hash = ? WHERE id = ?', [newHash, req.guest.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guests/forgot-password', async (req, res) => {
  try {
    const db = require('./db');
    const { email, phone } = req.body;
    if (!email || !phone) return res.status(400).json({ error: 'Email i telefon su obavezni.' });
    const [rows] = await db.query('SELECT * FROM guests WHERE email = ?', [email]);
    if (rows.length === 0 || rows[0].phone !== phone) {
      return res.json({ success: true, message: 'Ako podaci odgovaraju, poslaćemo link.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.query('UPDATE guests SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [resetToken, expires, rows[0].id]);
    const resetUrl = `${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/reset-lozinka/${resetToken}`;
    sendEmail(email, templates.resetPassword({ name: rows[0].name, resetUrl })).catch(console.error);
    res.json({ success: true, message: 'Ako podaci odgovaraju, poslaćemo link.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guests/reset-password/:token', async (req, res) => {
  try {
    const db = require('./db');
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Lozinka mora imati najmanje 6 znakova.' });
    const [rows] = await db.query('SELECT * FROM guests WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
    if (rows.length === 0) return res.status(400).json({ error: 'Link je istekao ili je nevažeći.' });
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE guests SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [newHash, rows[0].id]);
    res.json({ success: true, message: 'Lozinka uspešno promenjena.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
