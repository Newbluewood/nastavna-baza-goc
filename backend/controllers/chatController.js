// Novi, čisti AI-first chat controller
const aiService = require('../services/aiService');
const chatContextGuardService = require('../services/chatContextGuardService');
const chatMetricsService = require('../services/chatMetricsService');

// Sva pitanja idu kroz AI pipeline
async function planStayChat(req, res) {
  const payload = req.body || {};
  const userMessage = payload?.message || '';
  const provider = process.env.AI_PROVIDER || 'mock';
  const model = process.env.AI_MODEL || 'claude-sonnet-4-6';
  const apiKey = process.env.AI_API_KEY;
  let aiText = '';
  const axios = require('axios');
  let analysis = '';
  // Pass userId to AI context for logging separation
  const aiContext = { ...payload.context, userId: req.user && req.user.id };
  try {
    let facts = [];
    try {
      facts = aiService.extractRelevantFactsFromAnalysis(analysis);
    } catch (e) {
      facts = [];
    }
    let contextBlock = '';
    let smestajBlock = '';
    try {
      const path = require('path');
      const fs = require('fs');
      const pricesPath = path.join(__dirname, '../docs/prices.json');
      if (fs.existsSync(pricesPath)) {
        const prices = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));
        if (prices.prices && Array.isArray(prices.prices.smestaj)) {
          smestajBlock = '\nSmeštajna ponuda:\n' + prices.prices.smestaj.map(s => `- ${s.tip}: ${s.cena_po_noci} RSD/noć`).join('\n');
        }
      }
    } catch (e) { /* skip */ }
    if (facts.length > 0) {
      contextBlock = `Faktovi:\n${JSON.stringify(facts, null, 2)}`;
    } else {
      const path = require('path');
      const fs = require('fs');
      const docsDir = path.join(__dirname, '../docs');
      const allFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.json'));
      let sketch = {};
      for (const file of allFiles) {
        try {
          const raw = fs.readFileSync(path.join(docsDir, file), 'utf8');
          const data = JSON.parse(raw);
          for (const key of Object.keys(data)) {
            const val = data[key];
            if (Array.isArray(val) && val.length > 0) {
              sketch[`${file.replace('.json','')}.${key}`] = val[0];
            } else if (typeof val === 'object') {
              sketch[`${file.replace('.json','')}.${key}`] = val;
            }
          }
        } catch (e) { /* skip */ }
      }
      contextBlock = `Skica baze (primeri):\n${JSON.stringify(sketch, null, 2)}`;
    }
    const prompt = [
      'SISTEMSKE INSTRUKCIJE: Pretpostavi da korisnik pita nešto u vezi Goča, njegove ponude, smeštaja, atrakcija, događaja ili restorana iz naše baze. Odgovaraj ISKLJUČIVO na osnovu sledećih činjenica iz baze/skice. Ako korisnik pita za smeštaj, uvek prikaži sve dostupne objekte iz baze i cene. Ako korisnik želi rezervaciju, objasni da može rezervisati putem sajta ili kontakt podataka i navedi /reserve-stay endpoint ili kontakt podatke iz baze. Ako nema ni u skici, reci da nema podataka za Goč.',
      smestajBlock,
      contextBlock,
      `Korisničko pitanje: ${userMessage}`
    ].filter(Boolean).join('\n\n');
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: 512,
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );
    aiText = response.data.content?.[0]?.text || '';
    return res.json({
      status: 'ai_rag',
      assistant_message: aiText,
      provider: 'anthropic',
      model,
      facts,
      analysis
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Greška pri generisanju AI odgovora.',
      error: error.message
    });
  }
}

module.exports = {
  planStayChat,
  suggestVisitChat,
  reserveStayChat
};

// Ostatak starog koda je obrisan u AI-first refaktoru


async function suggestVisitChat(req, res) {
  const result = await suggestVisit(req.app.locals.db, req.body || {});
  return res.json(result);
}

async function reserveStayChat(req, res) {
  const db = req.app.locals.db;
  const body = req.body || {};

  if (!body.target_room_id || !body.check_in || !body.check_out) {
    return sendError(res, 400, 'target_room_id, check_in and check_out are required');
  }

  if (req.user?.id) {
    const result = await createInquiryWithGuest(db, {
      guestId: req.user.id,
      sender_name: req.user.name,
      email: req.user.email,
      phone: body.phone,
      message: body.message || 'Chat assistant reservation request',
      target_room_id: body.target_room_id,
      check_in: body.check_in,
      check_out: body.check_out,
      allowExistingGuestByEmail: true
    });

    return res.json({
      status: 'created',
      message: 'Reservation inquiry created for the logged-in guest.',
      inquiryId: result.inquiryId,
      guest: result.guest,
      newAccount: false
    });
  }

  if (!body.sender_name || !body.email) {
    return sendError(res, 400, 'sender_name and email are required when guest is not logged in');
  }

  try {
    const result = await createInquiryWithGuest(db, {
      sender_name: body.sender_name,
      email: body.email,
      phone: body.phone,
      message: body.message || 'Chat assistant reservation request',
      target_room_id: body.target_room_id,
      check_in: body.check_in,
      check_out: body.check_out,
      allowExistingGuestByEmail: false
    });

    return res.json({
      status: 'created',
      message: result.newAccount
        ? 'Guest account and reservation inquiry created. Login details were sent by email.'
        : 'Reservation inquiry created successfully.',
      inquiryId: result.inquiryId,
      guest: result.guest,
      newAccount: result.newAccount
    });
  } catch (error) {
    if (error.code === 'LOGIN_REQUIRED') {
      return res.status(409).json({
        status: 'login_required',
        message: 'Guest account already exists. Please log in to continue the reservation.',
        next_step: 'guest_login'
      });
    }

    if (error.code === 'ROOM_UNAVAILABLE') {
      return res.status(409).json({
        status: 'unavailable',
        message: error.message
      });
    }

    throw error;
  }
}

async function siteGuideTurn(req, res) {
  const { composeSiteGuideTurn } = require('../services/siteGuideService');
  const { validateAssistantTurn, makeFallbackAssistantTurn } = require('../services/assistantTurnSchema');
  const body = req.body || {};
  const message = String(body.message || '').trim();
  const lang = body.lang === 'en' ? 'en' : 'sr';

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const userKey = res.locals?.aiBudget?.userKey
    || (req.user?.id
      ? `admin:${req.user.id}`
      : (req.guest?.id
        ? `guest:${req.guest.id}`
        : `ip:${req.ip || 'unknown'}`));

  const turn = await composeSiteGuideTurn({ message, lang, userKey });

  try {
    validateAssistantTurn(turn);
  } catch (err) {
    // Defensive: composers above should always return a valid shape; if not,
    // log and degrade to the static fallback so the UI never sees garbage.
    console.error('[siteGuideTurn] invalid turn produced:', err.message);
    return res.status(200).json(makeFallbackAssistantTurn({ lang, reason: 'invalid_turn' }));
  }

  return res.status(200).json(turn);
}

module.exports = {
  planStayChat,
  suggestVisitChat,
  reserveStayChat,
  siteGuideTurn
};