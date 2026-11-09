const { upsertEnTranslation } = require('../upsertEnTranslation');

function mockDb(queryImpl) {
  return { query: jest.fn(queryImpl) };
}

describe('upsertEnTranslation', () => {
  test('updates existing EN row', async () => {
    const db = mockDb(async (sql) => {
      if (sql.startsWith('SELECT')) return [[{ id: 7 }]];
      return [{ affectedRows: 1 }];
    });

    await upsertEnTranslation(db, 'facility_translations', 3, {
      name: 'Hotel',
      description: 'Desc',
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE facility_translations SET/);
    expect(updateCall[1]).toEqual(['Hotel', 'Desc', 7]);
  });

  test('inserts when no EN row and values present', async () => {
    const db = mockDb(async (sql) => {
      if (sql.startsWith('SELECT')) return [[]];
      return [{ insertId: 11 }];
    });

    await upsertEnTranslation(db, 'room_translations', 9, {
      name: 'Room A',
      description: null,
      meal_info: 'Breakfast',
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    const insertCall = db.query.mock.calls[1];
    expect(insertCall[0]).toMatch(/INSERT INTO room_translations/);
    expect(insertCall[1]).toEqual([9, 'Room A', null, 'Breakfast']);
  });

  test('skips insert when no EN row and all values empty', async () => {
    const db = mockDb(async () => [[]]);

    await upsertEnTranslation(db, 'facility_translations', 1, {
      name: null,
      description: null,
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/^SELECT/);
  });
});
