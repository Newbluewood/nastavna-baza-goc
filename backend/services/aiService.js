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
  // Prikupi sve podatke iz baze
  const menuDoc = readJsonDoc('piramida-meni.json');
  const atrDoc = readJsonDoc('goc-gvozdac-okolina.json');
  const faqDoc = readJsonDoc('faq.json');
  const evDoc = readJsonDoc('events.json');
  const cDoc = readJsonDoc('contacts.json');
  const pDoc = readJsonDoc('prices.json');

  let facts = [];
  if (menuDoc && menuDoc.meni) {
    facts = facts.concat(Object.values(menuDoc.meni).flat().map(item => ({
      name: item.ime,
      ingredients: item.namernice,
      price: item.cena,
      _topic: 'restaurant_menu'
    })));
  }
  if (atrDoc && Array.isArray(atrDoc.atrakcije)) {
    facts = facts.concat(atrDoc.atrakcije.map(item => ({
      name: item.ime,
      description: item.opis,
      category: item.kategorija,
      _topic: 'attraction'
    })));
  }
  if (faqDoc && Array.isArray(faqDoc.faq)) {
    facts = facts.concat(faqDoc.faq.map(item => ({
      question: item.question,
      answer: item.answer,
      _topic: 'faq'
    })));
  }
  if (evDoc && Array.isArray(evDoc.events)) {
    facts = facts.concat(evDoc.events.map(item => ({
      name: item.name,
      date: item.date,
      description: item.description,
      _topic: 'event'
    })));
  }
  if (cDoc && Array.isArray(cDoc.contacts)) {
    facts = facts.concat(cDoc.contacts.map(item => ({
      type: item.type,
      phone: item.phone,
      email: item.email,
      _topic: 'contact'
    })));
  }
  if (pDoc) {

    if (Array.isArray(pDoc.accommodation)) {
      facts = facts.concat(pDoc.accommodation.map(item => ({
        type: item.type,
        price: item.price,
        _topic: 'price_accommodation'
      })));
    }
    if (Array.isArray(pDoc.activities)) {
      facts = facts.concat(pDoc.activities.map(item => ({
        name: item.name,
        price: item.price,
        _topic: 'price_activity'
      })));
    }
    if (Array.isArray(pDoc.food)) {
      facts = facts.concat(pDoc.food.map(item => ({
        item: item.item,
        price: item.price,
        _topic: 'price_food'
      })));
    }
  }

  // Priprema history (poslednje 2 korisničke poruke i poslednji AI odgovor)
  const lastUserMessages = history.filter(h => h.role === 'user').slice(-2).map(h => h.content);
  const lastAssistant = history.filter(h => h.role === 'assistant').slice(-1).map(h => h.content);

  // Precizne instrukcije za AI
  let instructions = `Odgovaraj prijateljski, jasno i sažeto.
Ako korisnik pita bilo šta vezano za hranu, piće, restoran, kafanu, kafić, meni, jelo, ručak, večeru, doručak, klopu, obrok, specijalitet, pića, desert, predjelo, glavno jelo, supe, čorbe, užinu – koristi podatke iz baze menija i predstavi ih.
Ako pita za aktivnosti, atrakcije, izlete, planinarenje, šetnje, vidikovce, livade, edukaciju, sport, rekreaciju, prirodu, banju – koristi podatke iz baze atrakcija.
Ako pita za cene, koristi podatke iz baze cena.
Ako pita za događaje, koristi podatke iz baze događaja.
Ako pita za kontakt, koristi podatke iz baze kontakata.
Ako pita za pravila, najčešća pitanja, koristi podatke iz baze FAQ.
Ako ne možeš da mapiraš, reci iskreno da nema podatka.
Kombinuj činjenice iz baze sa opštim znanjem, ali ne izmišljaj. Odgovor neka bude do 100 reči.`;


  // Uklonjena provera ključnih reči: za svako pitanje vraćaj sve podatke iz baze (ili fallback)

  // Priprema prompta za AI
  let prompt = buildAIPromptV2({
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
    { key: 'restoran', label: 'Restoran/meni' },
    { key: 'meni', label: 'Restoran/meni' },
    { key: 'hrana', label: 'Restoran/meni' },
    { key: 'jelo', label: 'Restoran/meni' },
    { key: 'piće', label: 'Restoran/meni' },
    { key: 'kafana', label: 'Restoran/meni' },
    { key: 'kafić', label: 'Restoran/meni' },
    { key: 'obrok', label: 'Restoran/meni' },
    { key: 'atrakcija', label: 'Atrakcije' },
    { key: 'izlet', label: 'Atrakcije' },
    { key: 'planinarenje', label: 'Atrakcije' },
    { key: 'šetnja', label: 'Atrakcije' },
    { key: 'vidikovac', label: 'Atrakcije' },
    { key: 'livada', label: 'Atrakcije' },
    { key: 'edukacija', label: 'Atrakcije' },
    { key: 'sport', label: 'Atrakcije' },
    { key: 'rekreacija', label: 'Atrakcije' },
    { key: 'priroda', label: 'Atrakcije' },
    { key: 'banja', label: 'Atrakcije' },
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
    { key: 'odgovor', label: 'Pravila/FAQ' },
    { key: 'rezervacija', label: 'Rezervacije' },
    { key: 'smeštaj', label: 'Smeštaj' },
    { key: 'parking', label: 'Parking' },
    // Plural
    { key: 'restorani', label: 'Restoran/meni' },
    { key: 'meniji', label: 'Restoran/meni' },
    { key: 'hrane', label: 'Restoran/meni' },
    { key: 'jela', label: 'Restoran/meni' },
    { key: 'pića', label: 'Restoran/meni' },
    { key: 'kafane', label: 'Restoran/meni' },
    { key: 'kafići', label: 'Restoran/meni' },
    { key: 'obroci', label: 'Restoran/meni' },
    { key: 'atrakcije', label: 'Atrakcije' },
    { key: 'izleti', label: 'Atrakcije' },
    { key: 'planinarenja', label: 'Atrakcije' },
    { key: 'šetnje', label: 'Atrakcije' },
    { key: 'vidikovci', label: 'Atrakcije' },
    { key: 'livade', label: 'Atrakcije' },
    { key: 'edukacije', label: 'Atrakcije' },
    { key: 'sportovi', label: 'Atrakcije' },
    { key: 'rekreacije', label: 'Atrakcije' },
    { key: 'prirode', label: 'Atrakcije' },
    { key: 'banje', label: 'Atrakcije' },
    { key: 'cene', label: 'Cene' },
    { key: 'cenovnici', label: 'Cene' },
    { key: 'plaćanja', label: 'Cene' },
    { key: 'događaji', label: 'Događaji' },
    { key: 'manifestacije', label: 'Događaji' },
    { key: 'dešavanja', label: 'Događaji' },
    { key: 'kontakti', label: 'Kontakt' },
    { key: 'telefoni', label: 'Kontakt' },
    { key: 'mejlovi', label: 'Kontakt' },
    { key: 'emailovi', label: 'Kontakt' },
    { key: 'pravila', label: 'Pravila/FAQ' },
    { key: 'faq', label: 'Pravila/FAQ' },
    { key: 'pitanja', label: 'Pravila/FAQ' },
    { key: 'odgovori', label: 'Pravila/FAQ' },
    { key: 'rezervacije', label: 'Rezervacije' },
    { key: 'smeštaji', label: 'Smeštaj' },
    { key: 'parkinga', label: 'Parking' }
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

  // Pripremi AI odgovor (prompt je za AI, ali ovde šaljemo i facts za test)
  return {
    reply: {
      text: inDomain
        ? `Evo šta mogu da preporučim:
${facts.map(f => f.name || f.item || f.question || f.type || '').toString()}`
        : 'Nema relevantnih podataka u bazi za ovo pitanje.'
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
