// Test za upit o restoranima: očekuje se konkretan meni i restorani iz baze
const aiService = require('./services/aiService');

describe('aiService.processAssistantMessageV2 - restoran upiti', () => {
  it('vraća meni iz baze za upit o restoranima', async () => {
    const res = await aiService.processAssistantMessageV2('Ima li dobrih restorana u blizini smeštaja?', {});
    // Očekujemo bar 5 stavki iz menija
    expect(res.facts.filter(f => f._topic === 'restaurant_menu').length).toBeGreaterThanOrEqual(5);
    // Svaka stavka ima ime i cenu
    res.facts.filter(f => f._topic === 'restaurant_menu').forEach(item => {
      expect(item.name).toBeDefined();
      expect(item.price).toBeDefined();
    });
  });

  it('dodaje restorane iz okoline ako postoje', async () => {
    const res = await aiService.processAssistantMessageV2('Preporuči kafanu ili restoran u okolini.', {});
    // Ako postoje atrakcije sa imenom restoran/kafana, očekujemo ih u rezultatu
    const nearby = res.facts.filter(f => f._topic === 'restaurant_nearby');
    // Test prolazi i ako ih nema, ali ako ih ima, moraju imati ime
    nearby.forEach(item => {
      expect(item.name).toBeDefined();
    });
  });

  it('ne vraća generički odgovor kada postoji meni', async () => {
    const res = await aiService.processAssistantMessageV2('Gde mogu da jedem?', {});
    // Ne sme biti fallback stringa
    expect(res.facts.some(f => typeof f === 'string' && f.includes('Nema relevantnih podataka'))).toBe(false);
    // Mora biti bar jedna stavka iz menija
    expect(res.facts.some(f => f._topic === 'restaurant_menu')).toBe(true);
  });
});
