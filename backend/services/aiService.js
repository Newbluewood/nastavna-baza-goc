/**
 * Na osnovu AI analize (tema, entiteti, namera) izdvaja relevantne činjenice iz svih JSON fajlova u docs folderu.
 * @param {string} analysisJson - JSON string sa poljima tema, entiteti, namera
 * @returns {Array} Lista relevantnih činjenica
 */
function extractRelevantFactsFromAnalysis(analysisJson) {
  let analysis;
  try {
    analysis = typeof analysisJson === 'string' ? JSON.parse(analysisJson) : analysisJson;
  } catch (e) {
    return [];
  }
  const keywords = [];
  if (analysis.tema) keywords.push(analysis.tema);
  if (Array.isArray(analysis.entiteti)) keywords.push(...analysis.entiteti);
  if (analysis.namera) keywords.push(analysis.namera);
  // Učitaj sve podatke iz docs
  const path = require('path');
  const fs = require('fs');
  const docsDir = path.join(__dirname, '../docs');
  const allFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.json'));
  let allFacts = [];
  for (const file of allFiles) {
    try {
      const raw = fs.readFileSync(path.join(docsDir, file), 'utf8');
      const data = JSON.parse(raw);
      // Heuristika: koristi sve nizove i objekte iz root-a
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val)) {
          allFacts.push(...val);
        } else if (typeof val === 'object') {
          allFacts.push(val);
        }
      }
    } catch (e) { /* skip */ }
  }
  // Filtriraj činjenice po ključnim rečima iz analize
  const lowerKeywords = keywords.map(k => String(k).toLowerCase());
  const relevant = allFacts.filter(fact => {
    const text = JSON.stringify(fact).toLowerCase();
    return lowerKeywords.some(k => text.includes(k));
  });
  return relevant;
}


// --- Prompt builder za AI ---
/**
 * Robustno učitava JSON fajl iz backend direktorijuma.
 * @param {string} filename - Ime fajla (npr. 'faq.json')
 * @returns {object|null} Parsirani JSON objekat ili null ako ne postoji ili je neispravan
 */
function readJsonDoc(filename) {
  const fs = require('fs');
  const path = require('path');
  try {
    // Traži u ../docs/ i fallback na ./ ako ne postoji
    const docsPath = path.join(__dirname, '../docs', filename);
    const localPath = path.join(__dirname, filename);
    let filePath = fs.existsSync(docsPath) ? docsPath : localPath;
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('readJsonDoc error:', filename, e.message);
    }
    return null;
  }
}

// --- Prompt builder za AI ---

// --- AI-FIRST PIPELINE: Svi podaci iz baze, AI bira ---
// (Pomereno ispod svih utility funkcija zbog scope-a)
async function processAssistantMessageV2(userMessage, context = {}, history = []) {
  // Semantic search config
  const USE_VECTOR_SEARCH = process.env.USE_VECTOR_SEARCH === 'true';
  let facts = [];
  let prompt = '';
  if (USE_VECTOR_SEARCH) {
    // Use Qdrant vector search for relevant facts
    try {
      const { searchFacts } = require('./vectorSearchService');
      facts = await searchFacts(userMessage, 7);
    } catch (e) {
      // fallback to keyword pipeline if vector search fails
      facts = [];
    }
  }
  if (!USE_VECTOR_SEARCH || facts.length === 0) {
    // Fallback: current keyword/heuristic pipeline
    const menuDoc = readJsonDoc('piramida-meni.json');
    const atrDoc = readJsonDoc('goc-gvozdac-okolina.json');
    const faqDoc = readJsonDoc('faq.json');
    const evDoc = readJsonDoc('events.json');
    const cDoc = readJsonDoc('contacts.json');
    const pDoc = readJsonDoc('prices.json');
    if (menuDoc && menuDoc.meni) {
      facts = facts.concat(Object.values(menuDoc.meni).flat().map(item => ({
        name: item.ime,
        ingredients: item.namernice,
        price: item.cena,
        _topic: 'restaurant_menu'
      })));
    }
    // DEBUG: Log atrDoc before mapping
    // eslint-disable-next-line no-console
    console.log('DEBUG aiService.js: atrDoc:', JSON.stringify(atrDoc, null, 2));
    if (atrDoc && Array.isArray(atrDoc.atrakcije)) {
      // DEBUG: Log loaded attractions and mapped facts
      // eslint-disable-next-line no-console
      console.log('DEBUG aiService.js: atrDoc.atrakcije:', JSON.stringify(atrDoc.atrakcije, null, 2));
      const mappedAttractions = atrDoc.atrakcije.map(item => {
        let tags = [];
        if (Array.isArray(item.category_tags)) {
          tags = item.category_tags;
        } else if (Array.isArray(item.kategorija)) {
          tags = item.kategorija;
        } else if (item.kategorija) {
          tags = [item.kategorija];
        }
        return {
          name: item.ime,
          description: item.opis,
          category_tags: tags,
          category: tags[0] || '',
          _topic: 'attraction'
        };
      });
      // eslint-disable-next-line no-console
      console.log('DEBUG aiService.js: mappedAttractions:', JSON.stringify(mappedAttractions, null, 2));
      facts = facts.concat(mappedAttractions);
    }
    if (faqDoc && Array.isArray(faqDoc.faq)) {
      facts = facts.concat(faqDoc.faq.map(item => ({
        question: item.pitanje || item.question,
        answer: item.odgovor || item.answer,
        _topic: 'faq'
      })));
    }
    if (evDoc && Array.isArray(evDoc.events)) {
      facts = facts.concat(evDoc.events.map(item => ({
        name: item.naziv || item.name,
        date: item.datum || item.date,
        description: item.opis || item.description,
        _topic: 'event'
      })));
    }
    if (cDoc && Array.isArray(cDoc.contacts)) {
      facts = facts.concat(cDoc.contacts.map(item => ({
        type: item.naziv || item.type,
        phone: item.telefon || item.phone,
        email: item.email,
        address: item.adresa || item.address,
        _topic: 'contact'
      })));
    }
    if (pDoc && pDoc.prices) {
      if (Array.isArray(pDoc.prices.smestaj)) {
        facts = facts.concat(pDoc.prices.smestaj.map(item => ({
          type: item.tip || item.type,
          price: item.cena_po_noci || item.price,
          _topic: 'price_accommodation'
        })));
      }
      if (Array.isArray(pDoc.prices.aktivnosti)) {
        facts = facts.concat(pDoc.prices.aktivnosti.map(item => ({
          name: item.aktivnost || item.name,
          price: item.cena || item.price,
          _topic: 'price_activity'
        })));
      }
      if (Array.isArray(pDoc.prices.hrana)) {
        facts = facts.concat(pDoc.prices.hrana.map(item => ({
          item: item.stavka || item.item,
          price: item.cena || item.price,
          _topic: 'price_food'
        })));
      }
    }
    // --- NEW JSONs ---
    const newsDoc = readJsonDoc('news.json');
    if (newsDoc && Array.isArray(newsDoc.news)) {
      facts = facts.concat(newsDoc.news.map(item => ({ ...item, _topic: 'news' })));
    }
    const annDoc = readJsonDoc('announcements.json');
    if (annDoc && Array.isArray(annDoc.announcements)) {
      facts = facts.concat(annDoc.announcements.map(item => ({ ...item, _topic: 'announcements' })));
    }
    const labsDoc = readJsonDoc('labs.json');
    if (labsDoc && Array.isArray(labsDoc.labs)) {
      facts = facts.concat(labsDoc.labs.map(item => ({ ...item, _topic: 'labs' })));
    }
    const wdDoc = readJsonDoc('wooddryer.json');
    if (wdDoc && Array.isArray(wdDoc.wooddryer)) {
      facts = facts.concat(wdDoc.wooddryer.map(item => ({ ...item, _topic: 'wooddryer' })));
    }
    const sawDoc = readJsonDoc('sawmill.json');
    if (sawDoc && Array.isArray(sawDoc.sawmill)) {
      facts = facts.concat(sawDoc.sawmill.map(item => ({ ...item, _topic: 'sawmill' })));
    }
    const campusDoc = readJsonDoc('campus.json');
    if (campusDoc && Array.isArray(campusDoc.campus)) {
      facts = facts.concat(campusDoc.campus.map(item => ({ ...item, _topic: 'campus' })));
    }
  }
  // Priprema history (poslednje 2 korisničke poruke i poslednji AI odgovor)
  const lastUserMessages = history.filter(h => h.role === 'user').slice(-2).map(h => h.content);
  const lastAssistant = history.filter(h => h.role === 'assistant').slice(-1).map(h => h.content);
  // Precizne instrukcije za AI (teme su sada ravnopravne, bez fokusa na rezervacije)
  let instructions = `Odgovaraj prijateljski, jasno i sažeto.
Svi tematski upiti su ravnopravni – koristi podatke iz baze i odgovaraj na pitanja o:
- ekosistemu rezervata na Goču
- životinjama (animals)
- gljivama (fungies)
- istoriji (kako je Univerzitet u Beogradu dobio Goč od kraljice, a zatim dao Šumarskom fakultetu)
- pejzažu (landscape)
- planinarenju (hiking)
- šumskim putevima i stazama (wood roadmaps, walking)
- mestima za posete i zanimljivostima (visits, interesting places)
- lovu (hunting)
- skijaškim stazama (ski tracks)
- studentima, kampusu i projektima (students, campus, projects)
- laboratorijama (laboratories)
- pilani (sawmill)
- sušari za drvo (wooddryer)
- restoranu (restaurant)
- sobama i smeštaju (rooms)
Ako korisnik pita za cene, koristi podatke iz baze cena.
Ako pita za događaje, koristi podatke iz baze događaja.
Ako pita za kontakt, koristi podatke iz baze kontakata.
Ako pita za pravila, najčešća pitanja, koristi podatke iz baze FAQ.
Ako ne možeš da mapiraš, reci iskreno da nema podatka.
Kombinuj činjenice iz baze sa opštim znanjem, ali ne izmišljaj. Odgovor neka bude do 250 reči.`;
  // Priprema prompta za AI
  prompt = buildAIPromptV2({
    message: userMessage,
    facts,
    context,
    instructions,
    history: { user: lastUserMessages, assistant: lastAssistant }
  });
  return { prompt, facts };
}

function buildAIPromptV2({ message, facts, context, instructions, history }) {
  const factsPreview = Array.isArray(facts)
    ? facts.slice(0, 10).map((f, i) => `${i + 1}. ${JSON.stringify(f)}`).join('\n')
    : '';
  // Detekcija top tema iz korisničkog pitanja
  let topTeme = [];
  const temaMap = [
    { key: 'ekosistem', label: 'Ekosistem' },
    { key: 'rezervat', label: 'Ekosistem' },
    { key: 'životinja', label: 'Životinje' },
    { key: 'životinje', label: 'Životinje' },
    { key: 'animal', label: 'Životinje' },
    { key: 'gljiva', label: 'Gljive' },
    { key: 'fungi', label: 'Gljive' },
    { key: 'istorija', label: 'Istorija' },
    { key: 'kraljica', label: 'Istorija' },
    { key: 'univerzitet', label: 'Istorija' },
    { key: 'šumarski fakultet', label: 'Istorija' },
    { key: 'pejzaž', label: 'Pejzaž' },
    { key: 'landscape', label: 'Pejzaž' },
    { key: 'planinarenje', label: 'Planinarenje' },
    { key: 'hiking', label: 'Planinarenje' },
    { key: 'šumski put', label: 'Šumski putevi' },
    { key: 'staza', label: 'Šumski putevi' },
    { key: 'wood road', label: 'Šumski putevi' },
    { key: 'šetnja', label: 'Šumski putevi' },
    { key: 'poseta', label: 'Mesta za posete' },
    { key: 'zanimljivost', label: 'Mesta za posete' },
    { key: 'hunting', label: 'Lov' },
    { key: 'lov', label: 'Lov' },
    { key: 'skijanje', label: 'Skijaške staze' },
    { key: 'ski', label: 'Skijaške staze' },
    { key: 'staza', label: 'Skijaške staze' },
    { key: 'student', label: 'Studenti' },
    { key: 'kampus', label: 'Kampus' },
    { key: 'projekat', label: 'Projekti' },
    { key: 'laboratorija', label: 'Laboratorije' },
    { key: 'sawmill', label: 'Pilana' },
    { key: 'pilana', label: 'Pilana' },
    { key: 'wooddryer', label: 'Sušara' },
    { key: 'sušara', label: 'Sušara' },
    { key: 'restoran', label: 'Restoran' },
    { key: 'meni', label: 'Restoran' },
    { key: 'hrana', label: 'Restoran' },
    { key: 'jelo', label: 'Restoran' },
    { key: 'soba', label: 'Sobe' },
    { key: 'smeštaj', label: 'Sobe' },
    { key: 'room', label: 'Sobe' },
    { key: 'accommodation', label: 'Sobe' },
    { key: 'cena', label: 'Cene' },
    { key: 'cenovnik', label: 'Cene' },
    { key: 'plaćanje', label: 'Cene' },
    { key: 'događaj', label: 'Događaji' },
    { key: 'manifestacija', label: 'Događaji' },
    { key: 'dešavanje', label: 'Događaji' },
    { key: 'kontakt', label: 'Kontakt' },
    { key: 'telefon', label: 'Kontakt' },
    { key: 'mejl', label: 'Kontakt' },
    { key: 'email', label: 'Kontakt' },
    { key: 'pravila', label: 'Pravila/FAQ' },
    { key: 'faq', label: 'Pravila/FAQ' },
    { key: 'pitanje', label: 'Pravila/FAQ' },
    { key: 'odgovor', label: 'Pravila/FAQ' }
  ];
  const msgNorm = (message || '').toLocaleLowerCase('sr-RS');
  for (const tema of temaMap) {
    if (msgNorm.includes(tema.key) && !topTeme.includes(tema.label)) {
      topTeme.push(tema.label);
    }
  }
  let topTemeSection = '';
  if (topTeme.length > 1) {
    topTemeSection = '\nTop teme: ' + topTeme.slice(0, 3).join(', ');
  }
  return [
    instructions || '',
    '\nKorisnička poruka:',
    message,
    topTemeSection,
    '\nFaktovi iz baze:',
    factsPreview,
    facts && facts.length > 10 ? `... (${facts.length - 10} još)` : '',
    history && history.user ? `\nIstorija korisnika: ${JSON.stringify(history.user)}` : '',
    history && history.assistant ? `\nIstorija asistenta: ${JSON.stringify(history.assistant)}` : '',
    context ? `\nKontekst: ${JSON.stringify(context)}` : ''
  ].filter(Boolean).join('\n');
}

/**
 * AI-first chat turn decision (minimal RAG/AI pipeline)
 * @param {object} param0 { message, context, lang }
 * @returns {Promise<object>} AI contract: { reply: { text }, guard: { class } }
 */
async function decideChatTurn({ message, context, lang }) {
  // Pokreni pipeline
  const { prompt, facts } = await processAssistantMessageV2(message, context || {}, []);

  // Detekcija domene: ako ima bar jednu relevantnu činjenicu, in_domain, inače out_of_domain
  let inDomain = Array.isArray(facts) && facts.length > 0 && typeof facts[0] !== 'string';
  let guardClass = inDomain ? 'in_domain' : 'out_of_domain';
  const replyText = inDomain
    ? `Evo šta mogu da preporučim:\n${facts.map(f => f.name || f.item || f.question || f.type || '').toString()}`
    : 'Nema relevantnih podataka u bazi za ovo pitanje.';
  // Q&A logging: personal if userId present, else global
  const userId = context && context.userId;
  const logPayload = {
    user_message: message,
    ai_reply: replyText,
    facts,
    guard: guardClass,
    timestamp: new Date().toISOString()
  };
  if (userId) {
    getUserQaLogger(userId).info(logPayload);
  } else {
    qaLogger.info(logPayload);
  }
  return {
    reply: {
      text: replyText
    },
    facts,
    prompt,
    guard: {
      class: guardClass
    }
  };
}

/**
 * Minimalni AI-first reply za chat, koristi pipeline i vraća tekst za asistenta
 */
async function composeChatReply({ mode, lang, userMessage, followUpQuestion, missing, criteria, suggestions }) {
  // Koristi pipeline za ekstrakciju činjenica
  const { facts } = await processAssistantMessageV2(userMessage, criteria || {}, []);
  if (Array.isArray(facts) && facts.length > 0 && typeof facts[0] !== 'string') {
    // Prikaži do 3 najrelevantnije činjenice
    const preview = facts.slice(0, 3).map(f => f.name || f.item || f.question || f.type || '').filter(Boolean).join(', ');
    return { text: preview ? `Evo šta mogu da preporučim: ${preview}` : 'Imam podatke, ali nisu detaljni.' };
  }
  // Ako nema podataka, AI daje kvalitetan opšti odgovor
  return { text: 'Na osnovu dostupnih informacija, nemam konkretan podatak iz baze, ali mogu pomoći opštim savetom ili informacijom.' };
}

module.exports = {
  processAssistantMessageV2,
  decideChatTurn,
  composeChatReply,
  extractRelevantFactsFromAnalysis
};
