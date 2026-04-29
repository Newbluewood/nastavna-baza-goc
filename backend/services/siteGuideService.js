'use strict';

/**
 * siteGuideService.js
 *
 * Composes an AssistantTurn response for the "site guide" feature.
 *
 * Resilience order (fail soft at every step):
 *   1. If AI is disabled or in mock mode  → keyword fallback.
 *   2. Vector search against `site_kb`    → keyword fallback on failure.
 *   3. No vector hits                     → keyword fallback.
 *   4. Claude Sonnet RAG call             → keyword fallback on failure.
 *   5. recordSpend is best-effort         → never surfaces to the caller.
 *
 * The final shape is always a validated AssistantTurn (validation is done
 * inside `makeAssistantTurn`, or the caller revalidates defensively).
 */

const path = require('path');
const fs = require('fs');

const { makeAssistantTurn } = require('./assistantTurnSchema');
const { searchInCollection } = require('./vectorSearchService');
const { recordSpend } = require('./aiBudgetService');

const DOCS_DIR = path.join(__dirname, '../docs');
const SITE_KB_COLLECTION = 'site_kb';

function normalizeUserQuestion(raw) {
  return String(raw || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function isTodaysDateQuestion(raw) {
  const c = normalizeUserQuestion(raw);
  const m = c.toLowerCase();
  if (/\bwhat\s+('?s\s+)?today'?s?\s+(date|day)\b/i.test(m)) return true;
  if (/\bwhat\s+day\b.*\btoday\b/i.test(m)) return true;
  if (/koji\s+je\s+danas\s+(dan|datum)\b/i.test(m)) return true;
  if (/koja\s+je\s+danas\s+(dan|datum)\b/i.test(m)) return true;
  if (/koji\s+je\s+dan\s+danas\b/i.test(m)) return true;
  if (/koja\s+je\s+dan\s+danas\b/i.test(m)) return true;
  if (/који\s+је\s+данас\s+(дан|датум)\b/i.test(c)) return true;
  if (/која\s+је\s+данас\s+(дан|датум)\b/i.test(c)) return true;
  return false;
}

function isGreetingQuestion(raw) {
  const m = normalizeUserQuestion(raw).toLowerCase();
  return (
    m === 'zdravo' ||
    m === 'cao' ||
    m === 'ćao' ||
    m === 'dobar dan' ||
    m === 'dobro jutro' ||
    m === 'dobro vece' ||
    m === 'dobro veče' ||
    m === 'hej' ||
    m === 'hello' ||
    m === 'hi'
  );
}

function makeGreetingTurnIfAsked(message, lang) {
  if (!isGreetingQuestion(message)) return null;
  const answer = lang === 'en'
    ? 'Hi! I can help you with accommodation, news, contact, site navigation, and current availability. Ask me anything about the site.'
    : 'Zdravo! Mogu da pomognem oko smeštaja, vesti, kontakta, navigacije kroz sajt i trenutne dostupnosti. Pitaj šta god te zanima o sajtu.';
  return makeAssistantTurn({
    answer,
    intent: 'site_guide',
    confidence: 1,
    suggestions: defaultNavigateSuggestions(lang),
    sources: [],
    meta: { source: 'greeting_turn' },
  });
}

function isSmallTalkQuestion(raw) {
  const m = normalizeUserQuestion(raw).toLowerCase();
  return (
    m === 'kako si' ||
    m === 'kako si?' ||
    m === 'how are you' ||
    m === 'how are you?' ||
    m === 'ko si' ||
    m === 'ko si?' ||
    m === 'who are you' ||
    m === 'who are you?' ||
    m === 'hvala' ||
    m === 'thanks' ||
    m === 'thank you'
  );
}

function makeSmallTalkTurnIfAsked(message, lang) {
  if (!isSmallTalkQuestion(message)) return null;
  const m = normalizeUserQuestion(message).toLowerCase();
  let answer;
  if (m.startsWith('kako si') || m.startsWith('how are you')) {
    answer = lang === 'en'
      ? "I'm doing great, thanks! I'm here to help you navigate the Goč site and find concrete info."
      : 'Odlično sam, hvala! Tu sam da pomognem oko snalaženja na sajtu i pronalaska konkretnih informacija.';
  } else if (m.startsWith('ko si') || m.startsWith('who are you')) {
    answer = lang === 'en'
      ? 'I am the Goč site guide assistant. I can help with accommodation, news, contact, activities, and site sections.'
      : 'Ja sam vodič-asistent za sajt Goča. Mogu da pomognem oko smeštaja, vesti, kontakta, aktivnosti i sekcija sajta.';
  } else {
    answer = lang === 'en'
      ? "You're welcome! If you want, ask me about accommodation, events, or anything available on the site."
      : 'Nema na čemu! Ako želiš, pitaj me za smeštaj, vesti, događaje ili bilo šta sa sajta.';
  }
  return makeAssistantTurn({
    answer,
    intent: 'site_guide',
    confidence: 1,
    suggestions: defaultNavigateSuggestions(lang),
    sources: [],
    meta: { source: 'smalltalk_turn' },
  });
}

function makeTodaysDateTurnIfAsked(message, lang) {
  if (!isTodaysDateQuestion(message)) return null;
  const locale = lang === 'en' ? 'en-GB' : 'sr-Cyrl-RS';
  const long = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const answer =
    lang === 'en'
      ? `Today is ${long} (server time).`
      : `Данас је ${long} (време сервера).`;
  return makeAssistantTurn({
    answer,
    intent: 'unknown',
    confidence: 1,
    suggestions: [],
    sources: [],
    meta: { source: 'server_clock', note: 'not_site_kb' },
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function humanizeStayTag(tag, lang) {
  const t = String(tag || '').toLowerCase();
  const mapSr = {
    group: 'pogodno za grupe',
    restaurant: 'restoran u objektu',
    central: 'centralna lokacija',
    conference: 'konferencijska sala',
    ski: 'blizina staza i zimskih aktivnosti',
    family: 'pogodno za porodice',
    quiet: 'mirniji ambijent',
  };
  const mapEn = {
    group: 'group-friendly',
    restaurant: 'restaurant on site',
    central: 'central location',
    conference: 'conference hall',
    ski: 'close to winter/ski activities',
    family: 'family-friendly',
    quiet: 'quiet environment',
  };
  return (lang === 'en' ? mapEn : mapSr)[t] || String(tag || '');
}

function looksLikeAvailabilityQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('slobodn') ||
    m.includes('zauzet') ||
    m.includes('dostupn') ||
    m.includes('availability') ||
    m.includes('ima li mesta') ||
    m.includes('ima li soba') ||
    m.includes('da li ima soba')
  );
}

function inferWindowDays(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('godin')) return 365;
  if (m.includes('mesec') || m.includes('mjesec')) return 30;
  if (m.includes('nedelj') || m.includes('tjed')) return 7;
  return 1;
}

async function makeAvailabilityFactsTurnIfAsked(message, lang) {
  if (!looksLikeAvailabilityQuestion(message)) return null;
  try {
    const db = require('../db');
    const days = inferWindowDays(message);
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    const startIso = now.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const [roomRows] = await db.query('SELECT COUNT(*) AS total_rooms FROM rooms');
    const [occRows] = await db.query(
      `SELECT COUNT(DISTINCT room_id) AS occupied_rooms
         FROM reservations
        WHERE status IN ('pending', 'confirmed')
          AND start_date < ?
          AND end_date > ?`,
      [endIso, startIso]
    );
    const total = Number(roomRows?.[0]?.total_rooms || 0);
    const occupied = Math.max(0, Number(occRows?.[0]?.occupied_rooms || 0));
    const free = Math.max(0, total - occupied);

    if (lang === 'en') {
      const scope = days === 1 ? 'today' : `the next ${days} days`;
      const answer = `Availability for ${scope}: ${free} free rooms, ${occupied} occupied (out of ${total}).`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.97,
        suggestions: [
          { label: 'Accommodation', route: '/smestaj', type: 'navigate' },
          { label: 'Open rooms', route: '/smestaj', type: 'action' },
          { label: 'Contact', route: '/kontakt', type: 'navigate' },
        ],
        sources: [],
        meta: { source: 'db_availability_facts', days, window: { startIso, endIso } },
      });
    }

    const scope = days === 1 ? 'danas' : `u narednih ${days} dana`;
    const answer = `Dostupnost ${scope}: slobodno je ${free} soba, zauzeto ${occupied} (ukupno ${total}).`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.97,
      suggestions: [
        { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
        { label: 'Pogledaj sobe', route: '/smestaj', type: 'action' },
        { label: 'Kontakt', route: '/kontakt', type: 'navigate' },
      ],
      sources: [],
      meta: { source: 'db_availability_facts', days, window: { startIso, endIso } },
    });
  } catch (err) {
    console.error('[siteGuide] availability facts query failed:', err.message);
    return null;
  }
}

function looksLikeOfferQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('ponud') ||
    m.includes('sadrzaj') ||
    m.includes('sadržaj') ||
    m.includes('smestaj') ||
    m.includes('smeštaj') ||
    m.includes('kapacitet') ||
    m.includes('sta ima') ||
    m.includes('šta ima') ||
    m.includes('cene') ||
    m.includes('cena') ||
    m.includes('cene smestaja') ||
    m.includes('cene smeštaja')
  );
}

function looksLikeStaffQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('zaposlen') ||
    m.includes('tim') ||
    m.includes('ko radi') ||
    m.includes('staff') ||
    m.includes('ko su ljudi') ||
    m.includes('ko je tamo')
  );
}

function looksLikeOverviewQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('sta sve ima') ||
    m.includes('šta sve ima') ||
    m.includes('sve o sajtu') ||
    m.includes('pregled sajta') ||
    m.includes('sta ima tamo na gocu') ||
    m.includes('šta ima tamo na goču')
  );
}

function looksLikeInterestingQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('zanimljivo') ||
    m.includes('preporuci') ||
    m.includes('preporuči') ||
    m.includes('sta da vidim') ||
    m.includes('šta da vidim') ||
    m.includes('sta predlazes') ||
    m.includes('šta predlažeš') ||
    m.includes('sta ima zanimljivo') ||
    m.includes('šta ima zanimljivo')
  );
}

function looksLikeAllKnowledgeQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('sta sve znas') ||
    m.includes('šta sve znaš') ||
    m.includes('sve cinjenice') ||
    m.includes('sve činjenice') ||
    m.includes('sve informacije') ||
    m.includes('sta sve mozes') ||
    m.includes('šta sve možeš')
  );
}

function detectKnowledgeDomains(message) {
  const m = String(message || '').toLowerCase();
  const domains = [];
  if (m.includes('vest') || m.includes('news') || m.includes('event')) domains.push('news');
  if (m.includes('atrakc') || m.includes('staz') || m.includes('hiking') || m.includes('trail')) domains.push('attractions');
  if (m.includes('sme') || m.includes('room') || m.includes('rezerv')) domains.push('accommodation');
  if (m.includes('header') || m.includes('footer') || m.includes('boj') || m.includes('color') || m.includes('ui') || m.includes('meni') || m.includes('navig')) domains.push('ui');
  if (m.includes('prijav') || m.includes('login') || m.includes('nalog') || m.includes('password') || m.includes('lozink')) domains.push('account');
  return Array.from(new Set(domains));
}

function looksLikeUiContentQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('header') ||
    m.includes('zaglav') ||
    m.includes('footer') ||
    m.includes('podnoz') ||
    m.includes('podnož') ||
    m.includes('dugmad') ||
    m.includes('dugme') ||
    m.includes('button') ||
    m.includes('boj') ||
    m.includes('color') ||
    m.includes('navigacij') ||
    m.includes('meni') ||
    m.includes('menu')
  );
}

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

async function buildKnowledgeSnapshot() {
  const db = require('../db');
  const [facilityRows] = await db.query("SELECT COUNT(*) AS n FROM facilities WHERE type = 'smestaj'");
  const [roomRows] = await db.query('SELECT COUNT(*) AS n FROM rooms');
  const [newsRows] = await db.query('SELECT COUNT(*) AS n FROM news');
  const [attrRows] = await db.query('SELECT COUNT(*) AS n FROM attractions WHERE is_active = 1');
  const [staffRows] = await db.query('SELECT COUNT(*) AS n FROM staff');
  const [recentNewsRows] = await db.query(
    `SELECT title
       FROM news
      ORDER BY created_at DESC
      LIMIT 3`
  );
  const [attractionRows] = await db.query(
    `SELECT name
       FROM attractions
      WHERE is_active = 1
      ORDER BY id ASC
      LIMIT 3`
  );

  const structure = readJsonSafe(path.join(DOCS_DIR, 'site-structure.json'), { routes: [] });
  const routes = Array.isArray(structure.routes) ? structure.routes : [];

  const appVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/App.vue'), 'utf8');
  const mainCss = fs.readFileSync(path.join(__dirname, '../../frontend/src/assets/main.css'), 'utf8');

  const navMatches = Array.from(appVue.matchAll(/to="([^"]+)"/g)).map((m) => m[1]).slice(0, 8);
  const uniqueNavRoutes = Array.from(new Set(navMatches));
  const colorVars = [];
  const varRegex = /--(c-braon-[1-6]|color-nav|color-border|color-accent)\s*:\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(mainCss)) !== null) {
    colorVars.push(`--${match[1]}=${String(match[2]).trim()}`);
    if (colorVars.length >= 4) break;
  }

  return {
    counts: {
      facilities: Number(facilityRows?.[0]?.n || 0),
      rooms: Number(roomRows?.[0]?.n || 0),
      news: Number(newsRows?.[0]?.n || 0),
      attractions: Number(attrRows?.[0]?.n || 0),
      staff: Number(staffRows?.[0]?.n || 0),
      routes: routes.length,
    },
    recentNews: (Array.isArray(recentNewsRows) ? recentNewsRows : []).map((r) => r.title).filter(Boolean),
    attractionNames: (Array.isArray(attractionRows) ? attractionRows : []).map((r) => r.name).filter(Boolean),
    navRoutes: uniqueNavRoutes,
    colors: colorVars,
  };
}

async function makeKnowledgeSnapshotTurnIfAsked(message, lang) {
  if (!looksLikeInterestingQuestion(message)) return null;
  try {
    const snap = await buildKnowledgeSnapshot();
    const topNews = snap.recentNews.length ? snap.recentNews.join(', ') : (lang === 'en' ? 'no recent entries yet' : 'trenutno bez novih unosa');
    const topAttractions = snap.attractionNames.length ? snap.attractionNames.join(', ') : (lang === 'en' ? 'no active attractions listed' : 'nema aktivnih atrakcija u listi');

    if (lang === 'en') {
      const answer =
        `Interesting right now: ${snap.counts.attractions} active attractions (${topAttractions}), ` +
        `${snap.counts.news} news items (latest: ${topNews}), and ${snap.counts.facilities} accommodation facilities with ${snap.counts.rooms} rooms. ` +
        `Main navigation routes: ${snap.navRoutes.join(', ')}.`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.95,
        suggestions: defaultNavigateSuggestions(lang),
        sources: [],
        meta: { source: 'knowledge_snapshot_facts' },
      });
    }

    const answer =
      `Trenutno zanimljivo: ${snap.counts.attractions} aktivnih atrakcija (${topAttractions}), ` +
      `${snap.counts.news} vesti (najnovije: ${topNews}) i ${snap.counts.facilities} smeštajnih objekata sa ${snap.counts.rooms} soba. ` +
      `Glavne rute u navigaciji: ${snap.navRoutes.join(', ')}.`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.95,
      suggestions: defaultNavigateSuggestions(lang),
      sources: [],
      meta: { source: 'knowledge_snapshot_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] knowledge snapshot failed:', err.message);
    return null;
  }
}

async function makeAllKnowledgeTurnIfAsked(message, lang) {
  if (!looksLikeAllKnowledgeQuestion(message)) return null;
  try {
    const snap = await buildKnowledgeSnapshot();
    const domains = detectKnowledgeDomains(message);
    const news = snap.recentNews.length ? snap.recentNews.join(', ') : (lang === 'en' ? 'n/a' : 'n/a');
    const attrs = snap.attractionNames.length ? snap.attractionNames.join(', ') : (lang === 'en' ? 'n/a' : 'n/a');
    const colors = snap.colors.length ? snap.colors.join(', ') : (lang === 'en' ? 'n/a' : 'n/a');
    const nav = snap.navRoutes.length ? snap.navRoutes.join(', ') : (lang === 'en' ? 'n/a' : 'n/a');
    const domainLinesSr = [];
    const domainLinesEn = [];
    if (domains.includes('news')) {
      domainLinesSr.push(`• vesti: ${snap.counts.news} unosa, najnovije: ${news}`);
      domainLinesEn.push(`• news: ${snap.counts.news} items, latest: ${news}`);
    }
    if (domains.includes('attractions')) {
      domainLinesSr.push(`• atrakcije: ${snap.counts.attractions} aktivnih, primeri: ${attrs}`);
      domainLinesEn.push(`• attractions: ${snap.counts.attractions} active, examples: ${attrs}`);
    }
    if (domains.includes('accommodation')) {
      domainLinesSr.push(`• smeštaj: ${snap.counts.facilities} objekata i ${snap.counts.rooms} soba`);
      domainLinesEn.push(`• accommodation: ${snap.counts.facilities} facilities and ${snap.counts.rooms} rooms`);
    }
    if (domains.includes('ui')) {
      domainLinesSr.push(`• UI/navigacija: rute ${nav}; paleta ${colors}`);
      domainLinesEn.push(`• UI/navigation: routes ${nav}; palette ${colors}`);
    }
    if (domains.includes('account')) {
      domainLinesSr.push('• nalog/prijava: podržane su prijava, reset lozinke i Moj nalog tokovi');
      domainLinesEn.push('• account/login: login, password reset, and My Account flows are supported');
    }

    if (lang === 'en') {
      const answer =
        `I can answer from multiple site layers: data (${snap.counts.facilities} facilities, ${snap.counts.rooms} rooms, ` +
        `${snap.counts.news} news, ${snap.counts.attractions} attractions, ${snap.counts.staff} staff), ` +
        `content/navigation (${snap.counts.routes} routes, nav: ${nav}), and UI theme facts (${colors}). ` +
        `Current examples: news=${news}; attractions=${attrs}.` +
        (domainLinesEn.length ? `\nFocused details:\n${domainLinesEn.join('\n')}` : '');
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.94,
        suggestions: defaultNavigateSuggestions(lang),
        sources: [],
        meta: { source: 'all_knowledge_facts', domains },
      });
    }

    const answer =
      `Mogu da odgovaram iz više slojeva sajta: podaci (${snap.counts.facilities} objekata, ${snap.counts.rooms} soba, ` +
      `${snap.counts.news} vesti, ${snap.counts.attractions} atrakcija, ${snap.counts.staff} zaposlenih), ` +
      `sadržaj/navigacija (${snap.counts.routes} ruta, navigacija: ${nav}) i UI tema (${colors}). ` +
      `Primeri trenutno: vesti=${news}; atrakcije=${attrs}.` +
      (domainLinesSr.length ? `\nFokus detalji:\n${domainLinesSr.join('\n')}` : '');
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.94,
      suggestions: defaultNavigateSuggestions(lang),
      sources: [],
      meta: { source: 'all_knowledge_facts', domains },
    });
  } catch (err) {
    console.error('[siteGuide] all knowledge facts failed:', err.message);
    return null;
  }
}

async function makeOverviewFactsTurnIfAsked(message, lang) {
  if (!looksLikeOverviewQuestion(message)) return null;
  try {
    const db = require('../db');
    const [facilityRows] = await db.query("SELECT COUNT(*) AS n FROM facilities WHERE type = 'smestaj'");
    const [roomRows] = await db.query('SELECT COUNT(*) AS n FROM rooms');
    const [newsRows] = await db.query('SELECT COUNT(*) AS n FROM news');
    const [attrRows] = await db.query('SELECT COUNT(*) AS n FROM attractions WHERE is_active = 1');
    const [staffRows] = await db.query('SELECT COUNT(*) AS n FROM staff');
    const structure = readJsonSafe(path.join(DOCS_DIR, 'site-structure.json'), { routes: [] });
    const routeCount = Array.isArray(structure.routes) ? structure.routes.length : 0;

    const facts = {
      facilities: Number(facilityRows?.[0]?.n || 0),
      rooms: Number(roomRows?.[0]?.n || 0),
      news: Number(newsRows?.[0]?.n || 0),
      attractions: Number(attrRows?.[0]?.n || 0),
      staff: Number(staffRows?.[0]?.n || 0),
      routes: routeCount,
    };

    if (lang === 'en') {
      const answer =
        `Site overview: ${facts.routes} main routes, ${facts.facilities} accommodation facilities, ${facts.rooms} rooms, ` +
        `${facts.news} news items, ${facts.attractions} active attractions, and ${facts.staff} staff members listed.`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.96,
        suggestions: defaultNavigateSuggestions(lang),
        sources: [],
        meta: { source: 'db_site_overview_facts' },
      });
    }
    const answer =
      `Pregled sajta: ${facts.routes} glavnih ruta, ${facts.facilities} smeštajnih objekata, ${facts.rooms} soba, ` +
      `${facts.news} vesti, ${facts.attractions} aktivnih atrakcija i ${facts.staff} zaposlenih u evidenciji.`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.96,
      suggestions: defaultNavigateSuggestions(lang),
      sources: [],
      meta: { source: 'db_site_overview_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] overview facts query failed:', err.message);
    return null;
  }
}

async function makeUiContentFactsTurnIfAsked(message, lang) {
  if (!looksLikeUiContentQuestion(message)) return null;
  try {
    const appVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/App.vue'), 'utf8');
    const mainCss = fs.readFileSync(path.join(__dirname, '../../frontend/src/assets/main.css'), 'utf8');

    const hasHeader = appVue.includes('<header class="header">');
    const hasFooter = appVue.includes('<footer class="footer">');
    const hasNav = appVue.includes('class="main-nav"');
    const hasGuestBtn = appVue.includes('class="guest-btn"');

    const colorVars = [];
    const varRegex = /--(c-braon-[1-6]|color-nav|color-border|color-accent)\s*:\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(mainCss)) !== null) {
      colorVars.push(`--${match[1]}=${String(match[2]).trim()}`);
      if (colorVars.length >= 6) break;
    }

    if (lang === 'en') {
      const answer =
        `UI facts: header=${hasHeader ? 'yes' : 'no'}, footer=${hasFooter ? 'yes' : 'no'}, nav=${hasNav ? 'yes' : 'no'}, ` +
        `guest button=${hasGuestBtn ? 'yes' : 'no'}. Theme uses brown palette variables (${colorVars.join(', ')}).`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.9,
        suggestions: [{ label: 'Home', route: '/', type: 'navigate' }],
        sources: [],
        meta: { source: 'ui_content_facts' },
      });
    }
    const answer =
      `UI činjenice: header=${hasHeader ? 'da' : 'ne'}, footer=${hasFooter ? 'da' : 'ne'}, navigacija=${hasNav ? 'da' : 'ne'}, ` +
      `guest dugme=${hasGuestBtn ? 'da' : 'ne'}. Tema koristi braon paletu (${colorVars.join(', ')}).`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.9,
      suggestions: [{ label: 'Naslovna', route: '/', type: 'navigate' }],
      sources: [],
      meta: { source: 'ui_content_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] ui content facts failed:', err.message);
    return null;
  }
}

async function makeStaffFactsTurnIfAsked(message, lang) {
  if (!looksLikeStaffQuestion(message)) return null;
  try {
    const db = require('../db');
    const [rows] = await db.query(
      `SELECT full_name, role
         FROM staff
        ORDER BY id ASC
        LIMIT 5`
    );
    const staff = Array.isArray(rows) ? rows.filter((r) => r.full_name) : [];
    if (staff.length === 0) return null;

    const lines = staff.map((p) => `• ${p.full_name}${p.role ? ` — ${p.role}` : ''}`).join('\n');
    if (lang === 'en') {
      const answer = `Team members listed on the site:\n${lines}\nFor direct communication, open Contact.`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.94,
        suggestions: [
          { label: 'Contact', route: '/kontakt', type: 'navigate' },
          { label: 'Home', route: '/', type: 'navigate' },
        ],
        sources: [],
        meta: { source: 'db_staff_facts' },
      });
    }
    const answer = `Ljudi koji su trenutno navedeni na sajtu:\n${lines}\nZa direktan kontakt otvorite Kontakt.`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.94,
      suggestions: [
        { label: 'Kontakt', route: '/kontakt', type: 'navigate' },
        { label: 'Naslovna', route: '/', type: 'navigate' },
      ],
      sources: [],
      meta: { source: 'db_staff_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] staff facts query failed:', err.message);
    return null;
  }
}

function looksLikeEventQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('vest') ||
    m.includes('vijest') ||
    m.includes('sta pise') ||
    m.includes('šta piše') ||
    m.includes('sta pise u vestima') ||
    m.includes('šta piše u vestima') ||
    m.includes('event') ||
    m.includes('dogadjaj') ||
    m.includes('događaj') ||
    m.includes('desava') ||
    m.includes('dešava') ||
    m.includes('najava') ||
    m.includes('aktuelno') ||
    m.includes('sta ima novo') ||
    m.includes('šta ima novo')
  );
}

function shortNewsText(v, max = 120) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function looksLikeHikingQuestion(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('pesac') ||
    m.includes('pešac') ||
    m.includes('setnj') ||
    m.includes('šetnj') ||
    m.includes('planinar') ||
    m.includes('staz') ||
    m.includes('hiking') ||
    m.includes('trail') ||
    m.includes('prirod') ||
    m.includes('aktivnost') ||
    m.includes('sta ima tamo za mene') ||
    m.includes('šta ima tamo za mene')
  );
}

async function makeHikingFactsTurnIfAsked(message, lang) {
  if (!looksLikeHikingQuestion(message)) return null;
  try {
    const db = require('../db');
    const [rows] = await db.query(
      `SELECT id, name, description, distance_km, distance_minutes
         FROM attractions
        WHERE is_active = 1
        ORDER BY id ASC
        LIMIT 6`
    );
    const attractions = Array.isArray(rows) ? rows : [];
    if (attractions.length === 0) return null;

    const picks = attractions.slice(0, 3);
    if (lang === 'en') {
      const lines = picks.map((a) => {
        const km = Number(a.distance_km);
        const mins = Number(a.distance_minutes);
        const extra = Number.isFinite(km) && km > 0
          ? ` (${km} km${Number.isFinite(mins) && mins > 0 ? `, about ${mins} min` : ''})`
          : '';
        return `• ${a.name}${extra}`;
      }).join('\n');
      const answer =
        `If you enjoy walking, here are suggestions around Goč:\n${lines}\n` +
        'Open News and Contact for fresh field updates and local guidance.';
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.92,
        suggestions: [
          { label: 'News', route: '/vesti', type: 'navigate' },
          { label: 'Contact', route: '/kontakt', type: 'navigate' },
          { label: 'Accommodation', route: '/smestaj', type: 'navigate' },
        ],
        sources: [],
        meta: { source: 'db_hiking_facts' },
      });
    }

    const lines = picks.map((a) => {
      const km = Number(a.distance_km);
      const mins = Number(a.distance_minutes);
      const extra = Number.isFinite(km) && km > 0
        ? ` (${km} km${Number.isFinite(mins) && mins > 0 ? `, oko ${mins} min` : ''})`
        : '';
      return `• ${a.name}${extra}`;
    }).join('\n');
    const answer =
      `Ako voliš pešačenje, evo dobrih predloga na Goču:\n${lines}\n` +
      'Za aktuelne informacije sa terena otvori Vesti ili Kontakt.';
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.92,
      suggestions: [
        { label: 'Vesti', route: '/vesti', type: 'navigate' },
        { label: 'Kontakt', route: '/kontakt', type: 'navigate' },
        { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
      ],
      sources: [],
      meta: { source: 'db_hiking_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] hiking facts query failed:', err.message);
    return null;
  }
}

async function makeEventsFactsTurnIfAsked(message, lang) {
  if (!looksLikeEventQuestion(message)) return null;
  try {
    const db = require('../db');
    const [rows] = await db.query(
      `SELECT id, title, excerpt, content, created_at
         FROM news
        ORDER BY created_at DESC
        LIMIT 3`
    );
    const news = Array.isArray(rows) ? rows : [];
    if (news.length === 0) return null;

    if (lang === 'en') {
      const lines = news.map((n) => {
        const details = shortNewsText(n.excerpt || n.content);
        return `• ${n.title || `News #${n.id}`}${details ? ` — ${details}` : ''}`;
      }).join('\n');
      const answer =
        `Current updates on the site:\n${lines}\nOpen News for full details and dates.`;
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.95,
        suggestions: [
          { label: 'All news', route: '/vesti', type: 'navigate' },
          { label: 'Home', route: '/', type: 'navigate' },
        ],
        sources: [],
        meta: { source: 'db_news_facts' },
      });
    }

    const lines = news.map((n) => {
      const details = shortNewsText(n.excerpt || n.content);
      return `• ${n.title || `Вест #${n.id}`}${details ? ` — ${details}` : ''}`;
    }).join('\n');
    const answer =
      `Тренутно најактуелније на сајту:\n${lines}\nОтворите Вести за цео текст и више детаља.`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.95,
      suggestions: [
        { label: 'Sve vesti', route: '/vesti', type: 'navigate' },
        { label: 'Naslovna', route: '/', type: 'navigate' },
      ],
      sources: [],
      meta: { source: 'db_news_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] events facts query failed:', err.message);
    return null;
  }
}

async function makeOfferFactsTurnIfAsked(message, lang) {
  if (!looksLikeOfferQuestion(message)) return null;
  try {
    // Lazy import to keep unit tests lightweight and avoid DB coupling.
    const db = require('../db');
    const [facilityRows] = await db.query(
      `SELECT id, name, capacity, capacity_min, capacity_max, stay_tags
         FROM facilities
        WHERE type = 'smestaj'
        ORDER BY id ASC
        LIMIT 12`
    );
    const [roomAggRows] = await db.query(
      `SELECT COUNT(*) AS rooms,
              MIN(COALESCE(capacity_min, capacity, 0)) AS min_cap,
              MAX(COALESCE(capacity_max, capacity, capacity_min, 0)) AS max_cap
         FROM rooms`
    );
    const facilities = Array.isArray(facilityRows) ? facilityRows : [];
    if (facilities.length === 0) return null;

    const roomAgg = roomAggRows && roomAggRows[0] ? roomAggRows[0] : {};
    const rooms = Number(roomAgg.rooms || 0);
    const minCap = Number(roomAgg.min_cap || 0);
    const maxCap = Number(roomAgg.max_cap || 0);

    const tags = new Set();
    for (const f of facilities) {
      for (const t of parseJsonArray(f.stay_tags)) {
        const s = String(t || '').trim();
        if (s) tags.add(s);
      }
    }
    const tagList = Array.from(tags).slice(0, 5).map((t) => humanizeStayTag(t, lang));

    if (lang === 'en') {
      const answer =
        `Current offer: ${facilities.length} accommodation facilities and ${rooms} rooms.` +
        (maxCap > 0 ? ` Typical room capacity is about ${Math.max(1, minCap)}-${maxCap} guests.` : '') +
        (tagList.length ? ` Main amenities: ${tagList.join(', ')}.` : '') +
        ' Open Accommodation for details and booking options.';
      return makeAssistantTurn({
        answer: answer.slice(0, 4000),
        intent: 'site_guide',
        confidence: 0.95,
        suggestions: [
          { label: 'Accommodation', route: '/smestaj', type: 'navigate' },
          { label: 'Open rooms', route: '/smestaj', type: 'action' },
          { label: 'Contact', route: '/kontakt', type: 'navigate' },
        ],
        sources: [],
        meta: { source: 'db_offer_facts' },
      });
    }

    const answer =
      `U ponudi je ${facilities.length} smeštajnih objekata i ukupno ${rooms} soba.` +
      (maxCap > 0 ? ` Tipičan kapacitet soba je oko ${Math.max(1, minCap)}-${maxCap} osoba.` : '') +
      (tagList.length ? ` Najčešći sadržaji: ${tagList.join(', ')}.` : '') +
      ' Otvorite Smeštaj za detalje i slanje upita.';
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.95,
      suggestions: [
        { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
        { label: 'Pogledaj sobe', route: '/smestaj', type: 'action' },
        { label: 'Kontakt', route: '/kontakt', type: 'navigate' },
      ],
      sources: [],
      meta: { source: 'db_offer_facts' },
    });
  } catch (err) {
    console.error('[siteGuide] offer facts query failed:', err.message);
    return null;
  }
}

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function safeString(v) {
  return typeof v === 'string' ? v : '';
}

function defaultNavigateSuggestions(lang) {
  if (lang === 'en') {
    return [
      { label: 'Accommodation', route: '/smestaj', type: 'navigate' },
      { label: 'News', route: '/vesti', type: 'navigate' },
      { label: 'Contact', route: '/kontakt', type: 'navigate' }
    ];
  }
  return [
    { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
    { label: 'Vesti', route: '/vesti', type: 'navigate' },
    { label: 'Kontakt', route: '/kontakt', type: 'navigate' }
  ];
}

/**
 * When static KB keyword scoring finds nothing (e.g. "hi"), explain why in a
 * calm way instead of implying the database is broken.
 * @param {'sr'|'en'} lang
 * @param {string} reason upstream tag from composeSiteGuideTurn
 */
function makeNoKeywordMatchTurn(lang, reason) {
  const isEn = lang === 'en';
  let answer;
  switch (reason) {
    case 'stable_mode':
      answer = isEn
        ? 'Guide mode is running in stable navigation mode. Ask about a page or choose a shortcut below.'
        : 'Водич тренутно ради у стабилном навигационом режиму. Питајте за страницу или изаберите пречицу испод.';
      break;
    case 'ai_disabled_or_mock':
      answer = isEn
        ? 'Live AI is off on the server, so I only match from this short list. Pick a page or ask with a longer phrase (e.g. “accommodation”, “news”).'
        : 'Живи AI је искључен на серверу, па овде радим само кратко упоређивање са листом испод. Изаберите страницу или пошаљите дуже питање (нпр. „смештај“, „вести“, „контакт“).';
      break;
    case 'vector_search_failed':
      answer = isEn
        ? 'Knowledge search is temporarily unavailable. Use the links below.'
        : 'Претрага упутства тренутно није доступна. Користите везе испод.';
      break;
    case 'no_vector_hits':
      answer = isEn
        ? 'I did not find a close match in the guide. Rephrase or choose a topic below.'
        : 'Нисам пронашао близак погодак у упутству. Покушајте другачије питање или изаберите тему испод.';
      break;
    case 'llm_call_failed':
      answer = isEn
        ? 'I pulled relevant pages but could not generate a short answer. Open a suggestion below.'
        : 'Имам релевантне странице, али кратак текст тренутно не могу да направим. Отворите предлог испод.';
      break;
    default:
      answer = isEn
        ? 'Please send a slightly longer question (e.g. “accommodation”, “news”, “login”) or tap a page below.'
        : 'Пошаљите мало дуже питање (нпр. „смештај“, „вести“, „пријава“) или изаберите страницу испод.';
  }
  return makeAssistantTurn({
    answer,
    intent: 'site_guide',
    confidence: 0.12,
    suggestions: defaultNavigateSuggestions(lang),
    sources: [],
    meta: { reason, fallback: 'no_keyword_match' }
  });
}

/**
 * Extract up to 4 suggestions from the top vector hits.
 * Each hit's payload may contain a `ctas` array; we flatten them while
 * respecting the per-turn cap of 4 suggestions (schema allows 6).
 */
function extractSuggestionsFromHits(hits, lang) {
  const out = [];
  for (const h of hits) {
    const ctas = Array.isArray(h.payload?.ctas) ? h.payload.ctas : [];
    for (const cta of ctas) {
      const label =
        (cta.label && (cta.label[lang] || cta.label.sr || cta.label.en)) ||
        String(cta.label || '');
      if (label && cta.route && out.length < 4) {
        out.push({
          label: String(label).slice(0, 80),
          route: String(cta.route).slice(0, 200),
          type: cta.type || 'navigate',
        });
      }
    }
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Build a no-LLM "keyword fallback" AssistantTurn from the static KB JSON
 * files. Used whenever the full RAG path is unavailable. If nothing in the
 * KB matches (or the message is too short for tokens), returns a contextual
 * turn with the same quick links — not an outage-style message.
 *
 * @param {string} message  User's raw question.
 * @param {'sr'|'en'} lang
 * @param {string} reason   Short tag explaining why we fell back.
 * @returns {Promise<AssistantTurn>}
 */
async function makeKeywordFallbackTurn(message, lang, reason) {
  let structure = { routes: [] };
  let features = { features: [] };
  try {
    structure = JSON.parse(
      fs.readFileSync(path.join(DOCS_DIR, 'site-structure.json'), 'utf8')
    );
  } catch (_) { /* structure stays empty */ }
  try {
    features = JSON.parse(
      fs.readFileSync(path.join(DOCS_DIR, 'features.json'), 'utf8')
    );
  } catch (_) { /* features stays empty */ }

  const entries = [
    ...(Array.isArray(structure.routes) ? structure.routes : [])
      .map((r) => ({ ...r, _kind: 'route' })),
    ...(Array.isArray(features.features) ? features.features : [])
      .map((f) => ({ ...f, _kind: 'feature' })),
  ];

  const msg = String(message || '').toLowerCase();
  const tokens = msg.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);

  const scored = entries
    .map((e) => {
      const hay = [
        safeString(e.sr),
        safeString(e.en),
        ...(Array.isArray(e.keywords) ? e.keywords : []),
        ...(Array.isArray(e.related) ? e.related : []),
        ...(Array.isArray(e.related_routes) ? e.related_routes : []),
        safeString(e.path),
        safeString(e.id),
      ]
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 1;
      }
      return { entry: e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    const legacyFacts = buildLegacyDocFacts(message, 3);
    if (legacyFacts.length === 0) {
      return makeNoKeywordMatchTurn(lang, reason);
    }
    const lines = legacyFacts.map((f) => {
      const obj = f.item || {};
      const title =
        obj.title || obj.name || obj.naziv || obj.ime || obj.question || obj.pitanje || `${f.root}/${f.key}`;
      const text =
        obj.excerpt || obj.description || obj.opis || obj.answer || obj.odgovor || '';
      return `• ${String(title)}${text ? ` — ${shortNewsText(text, 100)}` : ''}`;
    });
    const answer =
      lang === 'en'
        ? `I found related facts in the site docs:\n${lines.join('\n')}`
        : `Pronašao sam povezane činjenice u dokumentaciji sajta:\n${lines.join('\n')}`;
    return makeAssistantTurn({
      answer: answer.slice(0, 4000),
      intent: 'site_guide',
      confidence: 0.28,
      suggestions: defaultNavigateSuggestions(lang),
      sources: legacyFacts.map((f) => ({
        id: `${f.root}:${f.key}`.slice(0, 200),
        collection: 'legacy_docs_fallback',
        score: Math.min(1, f.score / 10),
      })),
      meta: { reason, fallback: 'legacy_docs' },
    });
  }

  const answerLines = [];
  if (lang === 'en') {
    answerLines.push('I found these pages that may help:');
  } else {
    answerLines.push('Pronašao sam ove stranice koje bi mogle da pomognu:');
  }
  for (const { entry } of scored) {
    const desc = entry[lang] || entry.sr || entry.en || '';
    const routePath =
      entry.path ||
      (Array.isArray(entry.related_routes) && entry.related_routes[0]) ||
      '/';
    answerLines.push(`• ${routePath} — ${desc}`);
  }

  const suggestions = [];
  for (const { entry } of scored) {
    const route =
      entry.path ||
      (Array.isArray(entry.related_routes) && entry.related_routes[0]);
    const ctas = Array.isArray(entry.ctas) ? entry.ctas : [];
    if (ctas.length > 0) {
      for (const cta of ctas.slice(0, 2)) {
        const label =
          (cta.label && (cta.label[lang] || cta.label.sr || cta.label.en)) ||
          String(cta.label || '');
        if (label && cta.route) {
          suggestions.push({
            label: String(label).slice(0, 80),
            route: String(cta.route).slice(0, 200),
            type: cta.type || 'navigate',
          });
        }
        if (suggestions.length >= 4) break;
      }
    } else if (route) {
      const label =
        lang === 'en'
          ? String(entry.en || route).slice(0, 80)
          : String(entry.sr || route).slice(0, 80);
      suggestions.push({
        label,
        route: String(route).slice(0, 200),
        type: 'navigate',
      });
    }
    if (suggestions.length >= 4) break;
  }

  const answer = answerLines.join('\n').slice(0, 4000);

  return makeAssistantTurn({
    answer,
    intent: 'site_guide',
    confidence: 0.4,
    suggestions,
    sources: scored.map((s) => ({
      id: String(s.entry.id || s.entry.path || 'unknown').slice(0, 200),
      collection: 'keyword_fallback',
      score: Math.min(1, s.score / 10),
    })),
    meta: { reason, fallback: 'keyword' },
  });
}

function buildStaticHitsFromDocs(message, limit = 5) {
  let structure = { routes: [] };
  let features = { features: [] };
  try {
    structure = JSON.parse(
      fs.readFileSync(path.join(DOCS_DIR, 'site-structure.json'), 'utf8')
    );
  } catch (_) { /* structure stays empty */ }
  try {
    features = JSON.parse(
      fs.readFileSync(path.join(DOCS_DIR, 'features.json'), 'utf8')
    );
  } catch (_) { /* features stays empty */ }

  const entries = [
    ...(Array.isArray(structure.routes) ? structure.routes : [])
      .map((r) => ({ ...r, _kind: 'route' })),
    ...(Array.isArray(features.features) ? features.features : [])
      .map((f) => ({ ...f, _kind: 'feature' })),
  ];
  const msg = String(message || '').toLowerCase();
  const tokens = msg.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
  const ranked = entries
    .map((e) => {
      const hay = [
        safeString(e.sr),
        safeString(e.en),
        ...(Array.isArray(e.keywords) ? e.keywords : []),
        ...(Array.isArray(e.related) ? e.related : []),
        ...(Array.isArray(e.related_routes) ? e.related_routes : []),
        safeString(e.path),
        safeString(e.id),
      ].join(' ').toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 1;
      }
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked
    .filter((r) => r.score > 0)
    .map((r) => ({
      id: `static:${r.entry.id || r.entry.path || 'entry'}`,
      score: Math.min(1, r.score / 10),
      payload: {
        kind: r.entry._kind || 'entry',
        path: r.entry.path || '/',
        sr: r.entry.sr || '',
        en: r.entry.en || '',
        ctas: Array.isArray(r.entry.ctas) ? r.entry.ctas : []
      },
      _static: true
    }));
}

function buildLegacyDocEntries(limit = 200) {
  let files = [];
  try {
    files = fs.readdirSync(DOCS_DIR).filter((f) => f.toLowerCase().endsWith('.json'));
  } catch (_) {
    return [];
  }

  const entries = [];
  for (const file of files) {
    const doc = readJsonSafe(path.join(DOCS_DIR, file), null);
    if (!doc || typeof doc !== 'object') continue;
    const root = path.basename(file, '.json');
    for (const [key, value] of Object.entries(doc)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') {
            entries.push({ root, key, item });
            if (entries.length >= limit) return entries;
          }
        }
      } else if (value && typeof value === 'object') {
        entries.push({ root, key, item: value });
        if (entries.length >= limit) return entries;
      }
    }
  }
  return entries;
}

function buildLegacyDocFacts(message, limit = 3) {
  const msg = String(message || '').toLowerCase();
  const tokens = msg.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  const entries = buildLegacyDocEntries(250);
  return entries
    .map((e) => {
      const hay = JSON.stringify(e.item).toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 1;
      }
      return { ...e, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Claude Sonnet RAG call, scoped to the top site-KB facts. Modelled after
 * the Anthropic Messages API pattern used by `planStayChat`.
 *
 * @param {{ message:string, hits:Array, lang:'sr'|'en' }} p
 * @returns {Promise<{ text:string, tokensIn:number, tokensOut:number, model:string }>}
 */
async function callClaudeSiteGuide({ message, hits, lang }) {
  const fetch = require('node-fetch');
  const model = process.env.AI_MODEL || 'claude-sonnet-4-6';
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY is not set');

  const factsBlock = hits
    .slice(0, 5)
    .map((h, i) => {
      const p = h.payload || {};
      const body = p[lang] || p.sr || p.en || '';
      return `(${i + 1}) [${p.kind || 'entry'} ${p.path || p.id || ''}] ${body}`;
    })
    .join('\n');

  const systemInstructions =
    lang === 'en'
      ? 'You are a concise site guide for the "Nastavna baza Goč" nature-reserve website. Answer ONLY from the knowledge-base facts below. Be brief (max 3 short sentences). If the facts do not contain the answer, say so and point to the most related pages. Respond in English.'
      : 'Ти си сажет водич кроз сајт „Наставна база Гоч". Одговарај ИСКЉУЧИВО на основу датих чињеница. Буди кратак (највише 3 кратке реченице). Ако у чињеницама нема одговора, реци то и упути на најсродније странице. Одговор пиши ћирилицом.';

  const metaFacts =
    lang === 'en'
      ? 'Site Developer / Programming: Nebojša Simović. Multimedia / Design: Jovan Mitrović. Owner: Faculty of Forestry, University of Belgrade (Kneza Višeslava 1, 11000 Belgrade). Contact Email: projektovanje@sfb.bg.ac.rs'
      : 'Програмирање и израда сајта: Небојша Симовић. Мултимедија и дизајн: Јован Митровић. Власник: Шумарски факултет Универзитета у Београду (Кнеза Вишеслава 1, 11000 Београд). Контакт е-маил: projektovanje@sfb.bg.ac.rs';

  const prompt = `${systemInstructions}\n\nОпште информације о сајту:\n${metaFacts}\n\nЧињенице из базе:\n${factsBlock}\n\nКорисничко питање: ${message}`;

  // node-fetch v2 honors the non-standard `timeout` option (ms). We also
  // defensively wrap the call with AbortController for environments where
  // node-fetch might be v3+ (ESM-only, ignores `timeout`). Either mechanism
  // triggers a rejection we surface as a normal Error.
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const abortTimer = controller
    ? setTimeout(() => controller.abort(), 15000)
    : null;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      timeout: 15000,
      signal: controller ? controller.signal : undefined,
    });
  } finally {
    if (abortTimer) clearTimeout(abortTimer);
  }

  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch (_) { /* ignore body parse failure */ }
    const snippet = bodyText ? ` — ${bodyText.slice(0, 200)}` : '';
    throw new Error(
      `Claude API returned ${response.status} ${response.statusText}${snippet}`
    );
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const tokensIn = data.usage?.input_tokens ?? 0;
  const tokensOut = data.usage?.output_tokens ?? 0;
  return { text, tokensIn, tokensOut, model };
}

/**
 * Compose a site-guide AssistantTurn for the given user message.
 *
 * @param {object} p
 * @param {string} p.message        User's raw question.
 * @param {'sr'|'en'} [p.lang='sr'] Language code.
 * @param {string} [p.userKey='anon'] Budget bucket key (e.g. 'guest:123').
 * @returns {Promise<import('./assistantTurnSchema').AssistantTurn>}
 */
async function composeSiteGuideTurn({
  message,
  lang = 'sr',
  userKey = 'anon',
}) {
  const safeLang = lang === 'en' ? 'en' : 'sr';
  const safeMessage = normalizeUserQuestion(message);

  const greetingTurn = makeGreetingTurnIfAsked(safeMessage, safeLang);
  if (greetingTurn) return greetingTurn;
  const smallTalkTurn = makeSmallTalkTurnIfAsked(safeMessage, safeLang);
  if (smallTalkTurn) return smallTalkTurn;
  const dateTurn = makeTodaysDateTurnIfAsked(safeMessage, safeLang);
  if (dateTurn) return dateTurn;
  const allKnowledgeTurn = await makeAllKnowledgeTurnIfAsked(safeMessage, safeLang);
  if (allKnowledgeTurn) return allKnowledgeTurn;
  const snapshotFactsTurn = await makeKnowledgeSnapshotTurnIfAsked(safeMessage, safeLang);
  if (snapshotFactsTurn) return snapshotFactsTurn;
  const overviewFactsTurn = await makeOverviewFactsTurnIfAsked(safeMessage, safeLang);
  if (overviewFactsTurn) return overviewFactsTurn;
  const uiContentFactsTurn = await makeUiContentFactsTurnIfAsked(safeMessage, safeLang);
  if (uiContentFactsTurn) return uiContentFactsTurn;
  const availabilityFactsTurn = await makeAvailabilityFactsTurnIfAsked(safeMessage, safeLang);
  if (availabilityFactsTurn) return availabilityFactsTurn;
  const staffFactsTurn = await makeStaffFactsTurnIfAsked(safeMessage, safeLang);
  if (staffFactsTurn) return staffFactsTurn;
  const hikingFactsTurn = await makeHikingFactsTurnIfAsked(safeMessage, safeLang);
  if (hikingFactsTurn) return hikingFactsTurn;
  const eventsFactsTurn = await makeEventsFactsTurnIfAsked(safeMessage, safeLang);
  if (eventsFactsTurn) return eventsFactsTurn;
  const offerFactsTurn = await makeOfferFactsTurnIfAsked(safeMessage, safeLang);
  if (offerFactsTurn) return offerFactsTurn;

  // 1. Short-circuit when AI is disabled or in mock mode.
  const provider = process.env.AI_PROVIDER || 'mock';
  const aiEnabled = process.env.AI_ENABLED !== 'false';
  if (provider === 'mock' || !aiEnabled) {
    return makeKeywordFallbackTurn(
      safeMessage,
      safeLang,
      'ai_disabled_or_mock'
    );
  }

  // 2. Vector search.
  let hits;
  try {
    hits = await searchInCollection(safeMessage, SITE_KB_COLLECTION, 5);
  } catch (err) {
    console.error('[siteGuide] vector search failed:', err.message);
    hits = buildStaticHitsFromDocs(safeMessage, 5);
  }

  // 3. No hits.
  if (!Array.isArray(hits) || hits.length === 0) {
    hits = buildStaticHitsFromDocs(safeMessage, 5);
    if (!Array.isArray(hits) || hits.length === 0) {
      return makeKeywordFallbackTurn(safeMessage, safeLang, 'no_vector_hits');
    }
  }

  // 4. Claude RAG call.
  let llm;
  try {
    llm = await callClaudeSiteGuide({
      message: safeMessage,
      hits,
      lang: safeLang,
    });
  } catch (err) {
    console.error('[siteGuide] Claude call failed:', err.message);
    return makeKeywordFallbackTurn(safeMessage, safeLang, 'llm_call_failed');
  }

  const { text, tokensIn, tokensOut, model } = llm;

  // 5. Best-effort spend accounting. Never fails the user-facing response.
  try {
    await recordSpend({
      userKey,
      feature: 'site_guide',
      model,
      tokensIn,
      tokensOut,
    });
  } catch (err) {
    console.error('[siteGuide] recordSpend failed:', err.message);
  }

  // 6. Final AssistantTurn.
  const answer = (text && text.trim().length > 0
    ? text
    : safeLang === 'en'
    ? 'I could not generate an answer from the knowledge base right now.'
    : 'Trenutno ne mogu da formiram odgovor iz baze znanja.'
  ).slice(0, 4000);

  const confidence = clamp01(hits[0]?.score);
  const suggestions = extractSuggestionsFromHits(hits.slice(0, 3), safeLang);
  const sources = hits.slice(0, 10).map((h) => ({
    id: String(h.id).slice(0, 200),
    collection: SITE_KB_COLLECTION,
    score: clamp01(h.score),
  }));

  return makeAssistantTurn({
    answer,
    intent: 'site_guide',
    confidence,
    suggestions,
    sources,
    meta: {
      model,
      tokensIn,
      tokensOut,
      hits: hits.length,
    },
  });
}

module.exports = {
  composeSiteGuideTurn,
  _internal: {
    callClaudeSiteGuide,
    makeKeywordFallbackTurn,
    extractSuggestionsFromHits,
  },
};
