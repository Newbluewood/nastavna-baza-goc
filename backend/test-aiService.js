// Jednostavan test za aiService.js (RAG/AI pipeline)
const aiService = require('./services/aiService');
const assert = require('assert');

async function testFactsExtraction() {
  // Test: meni
  let res = await aiService.processAssistantMessageV2('Šta ima u restoranu?', {});
  assert(res.facts.some(f => f._topic === 'restaurant_menu'), 'Meni nije pronađen');
  console.log('✔ Meni extraction OK');

  // Test: atrakcije
  res = await aiService.processAssistantMessageV2('Koje su atrakcije u okolini?', {});
  assert(res.facts.some(f => f._topic === 'attraction'), 'Atrakcije nisu pronađene');
  console.log('✔ Atrakcije extraction OK');

  // Test: FAQ
  res = await aiService.processAssistantMessageV2('Kako da rezervišem smeštaj?', {});
  assert(res.facts.some(f => f._topic === 'faq'), 'FAQ nije pronađen');
  console.log('✔ FAQ extraction OK');

  // Test: događaji
  res = await aiService.processAssistantMessageV2('Koji su događaji na Gocu?', {});
  assert(res.facts.some(f => f._topic === 'event'), 'Događaji nisu pronađeni');
  console.log('✔ Events extraction OK');

  // Test: kontakt
  res = await aiService.processAssistantMessageV2('Kontakt recepcije?', {});
  assert(res.facts.some(f => f._topic === 'contact'), 'Kontakt nije pronađen');
  console.log('✔ Contact extraction OK');

  // Test: cene
  res = await aiService.processAssistantMessageV2('Koliko košta noćenje?', {});
  assert(res.facts.some(f => f._topic && f._topic.startsWith('price')), 'Cene nisu pronađene');
  console.log('✔ Prices extraction OK');

  // Test: fallback
  res = await aiService.processAssistantMessageV2('asdasdasd', {});
  assert(res.facts[0] === 'Nema relevantnih podataka u bazi za ovo pitanje.', 'Fallback ne radi');
  console.log('✔ Fallback OK');

  // Test: prompt sadrži top 3 teme
  res = await aiService.processAssistantMessageV2('restoran i atrakcije i kontakt', {});
  assert(res.prompt.includes('Top teme'), 'Prompt ne sadrži top teme');
  console.log('✔ Prompt top teme OK');

  console.log('\nSvi AI pipeline testovi prošli!');
}

testFactsExtraction().catch(e => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
