// Standalone test for aiService.processAssistantMessageV2 - svi topici
const aiService = require('./services/aiService');

const topicTests = [
  { question: 'Koje su najnovije vesti na Goču?', topic: 'news', expectField: 'title' },
  { question: 'Ima li novih obaveštenja?', topic: 'announcements', expectField: 'title' },
  { question: 'Koje laboratorije postoje?', topic: 'labs', expectField: 'name' },
  { question: 'Šta je sušara za drvo?', topic: 'wooddryer', expectField: 'name' },
  { question: 'Gde se nalazi pilana?', topic: 'sawmill', expectField: 'name' },
  { question: 'Šta nudi studentski kampus?', topic: 'campus', expectField: 'name' },
  { question: 'Koje su atrakcije u okolini?', topic: 'attraction', expectField: 'name' },
  { question: 'Koje su cene smeštaja?', topic: 'price_accommodation', expectField: 'type' },
  { question: 'Koje su aktivnosti dostupne?', topic: 'price_activity', expectField: 'name' },
  { question: 'Koja su česta pitanja?', topic: 'faq', expectField: 'question' },
  { question: 'Koji su kontakti?', topic: 'contact', expectField: 'type' },
  { question: 'Koji su događaji?', topic: 'event', expectField: 'name' },
  { question: 'Šta ima u meniju restorana?', topic: 'restaurant_menu', expectField: 'name' }
];

(async () => {
  for (const { question, topic, expectField } of topicTests) {
    try {
      const res = await aiService.processAssistantMessageV2(question, {});
      const facts = res.facts.filter(f => f._topic === topic || (f._topic === undefined && topic === 'news' && f.title));
      if (facts.length > 0) {
        let allFields = facts.every(item => item[expectField] !== undefined);
        if (allFields) {
          console.log(`✔ Tema: ${topic} (${question})`);
        } else {
          console.log(`❗ Tema: ${topic} - neki item nema ${expectField}`);
        }
      } else {
        console.log(`❗ Tema: ${topic} - nema rezultata`);
      }
    } catch (e) {
      console.error(`❗ Tema: ${topic} - error`, e);
    }
  }
})();
