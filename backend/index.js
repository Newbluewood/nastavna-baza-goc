require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/api/home', async (req, res) => {
  try {
    const db = require('./db');
    
    // Dohvata tekstualni opis pocetne
    const [pageRows] = await db.query("SELECT * FROM pages WHERE slug = 'pocetna' LIMIT 1");
    const pageData = pageRows[0] || {};

    // Dohvata slajdere za hero
    const [slides] = await db.query("SELECT title, subtitle, image_url, target_link FROM hero_slides WHERE page_slug = 'pocetna' ORDER BY display_order ASC");

    // Dohvata 3 najnovije vesti
    const [news] = await db.query('SELECT id, title, excerpt, cover_image, created_at FROM news ORDER BY created_at DESC LIMIT 3');

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
    
    // Dohvata opis za stranicu smestaj
    const [pageRows] = await db.query("SELECT * FROM pages WHERE slug = 'smestaj' LIMIT 1");
    const pageData = pageRows[0] || {};

    // Dohvata slajdere
    const [slides] = await db.query("SELECT title, subtitle, image_url, target_link FROM hero_slides WHERE page_slug = 'smestaj' ORDER BY display_order ASC");

    // Dohvata sve smestajne objekte (Facilities)
    const [facilities] = await db.query("SELECT id, name, description, capacity, cover_image FROM facilities WHERE type = 'smestaj'");

    const data = {
      pageTitle: pageData.title || "Смештај",
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

app.post('/api/inquiries', async (req, res) => {
  try {
    const db = require('./db');
    const { sender_name, email, phone, message, target_facility_id } = req.body;
    
    if (!sender_name || !message) {
      return res.status(400).json({ error: "Ime i poruka su obavezni." });
    }

    const query = `
      INSERT INTO inquiries (sender_name, email, phone, message, target_facility_id) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await db.query(query, [sender_name, email || null, phone || null, message, target_facility_id || null]);
    
    res.json({ success: true, message: "Vaš upit je uspešno poslat." });
  } catch (error) {
    console.error("Greška pri čuvanju upita/rezervacije:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
