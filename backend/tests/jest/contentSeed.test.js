const {
  planFirstBoot,
  applyFirstBoot,
  writeSeedFile,
  isProductionLikeHost,
} = require('../../scripts/lib/contentSeed');
const fs = require('fs');
const os = require('os');
const path = require('path');

function mockDb(counts) {
  return {
    async query(sql) {
      const m = String(sql).match(/FROM\s+(\w+)/i);
      const table = m ? m[1] : '';
      if (/COUNT\(\*\)/i.test(sql)) {
        return [[{ c: counts[table] ?? 0 }]];
      }
      throw new Error(`unexpected query in test: ${sql}`);
    },
  };
}

describe('contentSeed first-boot planning', () => {
  test('populated tables are skipped', async () => {
    const seed = {
      themes: [{ slug: 'a' }],
      pages: [{ slug: 'b' }],
      news: [{ slug: 'c' }],
      attractions: [{ name: 'd' }],
      menu: [{ name: 'e', attraction_name: 'd' }],
    };
    const plan = await planFirstBoot(
      mockDb({
        themes: 3,
        pages: 2,
        news: 5,
        attractions: 4,
        restaurant_menu_items: 10,
      }),
      seed
    );
    expect(plan.themes.action).toBe('skip');
    expect(plan.pages.action).toBe('skip');
    expect(plan.news.action).toBe('skip');
    expect(plan.attractions.action).toBe('skip');
    expect(plan.menu.action).toBe('skip');
  });

  test('empty tables would insert', async () => {
    const seed = {
      themes: [{ slug: 'a' }],
      pages: [],
      news: [],
      attractions: [],
      menu: [],
    };
    const plan = await planFirstBoot(
      mockDb({
        themes: 0,
        pages: 0,
        news: 0,
        attractions: 0,
        restaurant_menu_items: 0,
      }),
      seed
    );
    expect(plan.themes.action).toBe('insert');
    expect(plan.themes.seed).toBe(1);
    expect(plan.pages.action).toBe('insert');
  });

  test('dry-run never writes even when empty', async () => {
    const inserts = [];
    const db = {
      async query(sql, params) {
        if (/COUNT\(\*\)/i.test(sql)) return [[{ c: 0 }]];
        inserts.push({ sql, params });
        return [{ insertId: 1 }];
      },
    };
    const result = await applyFirstBoot(db, { themes: [{ slug: 'x', name_sr: 'X' }] }, { execute: false });
    expect(result.dryRun).toBe(true);
    expect(inserts).toHaveLength(0);
  });

  test('execute on populated DB writes nothing', async () => {
    const inserts = [];
    const db = {
      async query(sql, params) {
        if (/COUNT\(\*\)/i.test(sql)) return [[{ c: 2 }]];
        inserts.push({ sql, params });
        return [{ insertId: 1 }];
      },
    };
    const result = await applyFirstBoot(
      db,
      { themes: [{ slug: 'x' }], pages: [], news: [], attractions: [], menu: [] },
      { execute: true, host: 'localhost' }
    );
    expect(result.wrote).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  test('refuses --force', async () => {
    const db = mockDb({
      themes: 0,
      pages: 0,
      news: 0,
      attractions: 0,
      restaurant_menu_items: 0,
    });
    await expect(
      applyFirstBoot(db, { themes: [] }, { execute: true, force: true })
    ).rejects.toThrow(/Refusing --force/);
  });

  test('production-like host detection', () => {
    expect(isProductionLikeHost('foo.aivencloud.com')).toBe(true);
    expect(isProductionLikeHost('localhost')).toBe(false);
  });

  test('writeSeedFile roundtrip shape', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goc-seed-'));
    const file = path.join(dir, 'content-seed.json');
    writeSeedFile({ themes: [{ slug: 't' }], sourceHost: 'test' }, file);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.themes[0].slug).toBe('t');
    expect(parsed.purpose).toMatch(/first-boot/);
  });
});
