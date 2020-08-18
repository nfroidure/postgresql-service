import assert from 'assert';
import YError from 'yerror';
import initPGMock from './pg.mock';
import sql from './sql';

describe('initPGMock', () => {
  test('should work', async () => {
    const pg = await initPGMock();

    assert(pg);
  });

  describe('pg.query', () => {
    test('should work', async () => {
      const { service: pg } = await initPGMock();

      pg.query.mockResultOnce({ rows: [], fields: {} });

      await pg.query(sql`SELECT * FROM users WHERE id = ${1}`);

      expect(pg.query.mock.calls).toMatchSnapshot();
    });

    test('should fail with malformed query', async () => {
      const { service: pg } = await initPGMock();

      pg.query.mockResultOnce({ rows: [], fields: {} });

      try {
        await pg.query(sql`SELECT * FROM`);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect({
          errorCode: err.code,
          errorParams: err.params,
        }).toMatchSnapshot();
      }
    });
  });

  describe('pg.queries', () => {
    test('should work', async () => {
      const { service: pg } = await initPGMock();

      pg.queries.mockResultOnce([{ rows: [], fields: {} }]);

      await pg.queries([
        sql`SELECT * FROM users WHERE id = ${1}`,
        sql`SELECT * FROM users WHERE id = ${1}`,
      ]);

      expect(pg.queries.mock.calls).toMatchSnapshot();
    });
  });

  describe('pg.transaction', () => {
    test('should work', async () => {
      const { service: pg } = await initPGMock();

      pg.transaction.mockResultOnce([{ rows: [], fields: {} }]);

      await pg.transaction([
        sql`SELECT * FROM users WHERE id = ${1}`,
        sql`SELECT * FROM users WHERE id = ${1}`,
      ]);

      expect(pg.transaction.mock.calls).toMatchSnapshot();
    });
  });
});
