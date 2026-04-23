// Standalone test for aiService.processAssistantMessageV2 - restoran upiti
const aiService = require('./services/aiService');

(async () => {
  try {
    // Test 1: meni iz baze za restorane
    const res1 = await aiService.processAssistantMessageV2('Ima li dobrih restorana u blizini smeštaja?', {});
    const menuItems = res1.facts.filter(f => f._topic === 'restaurant_menu');
    if (menuItems.length >= 5) {
      console.log('✔ Meni ima bar 5 stavki');
    } else {
      console.log(`❗ Meni ima samo ${menuItems.length} stavki`);
    }
    menuItems.forEach(item => {
      if (item.name && item.price) {
        console.log(`✔ Stavka: ${item.name} (${item.price})`);
      } else {
        console.log('❗ Stavka bez imena ili cene:', item);
      }
    });

    // Test 2: restorani iz okoline
    const res2 = await aiService.processAssistantMessageV2('Preporuči kafanu ili restoran u okolini.', {});
    const nearby = res2.facts.filter(f => f._topic === 'restaurant_nearby');
    if (nearby.length > 0) {
      nearby.forEach(item => {
        if (item.name) {
          console.log(`✔ Restoran u okolini: ${item.name}`);
        } else {
          console.log('❗ Restoran bez imena:', item);
        }
      });
    } else {
      console.log('ℹ️ Nema restorana u okolini (nije greška)');
    }

    // Test 3: fallback string
    const res3 = await aiService.processAssistantMessageV2('Gde mogu da jedem?', {});
    const hasFallback = res3.facts.some(f => typeof f === 'string' && f.includes('Nema relevantnih podataka'));
    if (!hasFallback) {
      console.log('✔ Nema fallback stringa');
    } else {
      console.log('❗ Fallback string pronađen!');
    }
    const hasMenu = res3.facts.some(f => f._topic === 'restaurant_menu');
    if (hasMenu) {
      console.log('✔ Pronađena bar jedna stavka iz menija');
    } else {
      console.log('❗ Nema stavki iz menija');
    }
  } catch (e) {
    console.error('❗ Test error:', e);
  }
})();
