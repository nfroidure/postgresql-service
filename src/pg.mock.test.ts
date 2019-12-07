import assert from 'assert';
import YError from 'yerror';
import initPGMock from './pg.mock';

describe('initPGMock', () => {
  test('should work', async () => {
    const pg = await initPGMock();

    assert(pg);
  });

  describe('pg.query', () => {
    test('should work', async () => {
      const { service: pg } = await initPGMock();

      pg.query.mockResultOnce({ rows: [], fields: {} });

      await pg.query('SELECT * FROM users WHERE id = $$userId', { userId: 1 });

      expect(pg.query.mock.calls).toMatchSnapshot();
    });

    test('should fail with lacking args', async () => {
      const { service: pg } = await initPGMock();

      pg.query.mockResultOnce({ rows: [], fields: {} });

      try {
        await pg.query('SELECT * FROM users WHERE id = $$userId', {});
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect({
          errorCode: err.code,
          errorParams: err.params,
        }).toMatchSnapshot();
      }
    });

    test('should fail with malformed query', async () => {
      const { service: pg } = await initPGMock();

      pg.query.mockResultOnce({ rows: [], fields: {} });

      try {
        await pg.query('SELECT * FROM', {});
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

      await pg.queries(
        [
          'SELECT * FROM users WHERE id = $$userId',
          'SELECT * FROM users WHERE id = $$userId',
        ],
        { userId: 1 },
      );

      expect(pg.queries.mock.calls).toMatchSnapshot();
    });

    test('should fail with lacking args', async () => {
      const { service: pg } = await initPGMock();

      pg.queries.mockResultOnce([{ rows: [], fields: {} }]);

      try {
        await pg.queries(['SELECT * FROM users WHERE id = $$userId'], {});
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect({
          errorCode: err.code,
          errorParams: err.params,
        }).toMatchSnapshot();
      }
    });
  });

  describe('pg.transaction', () => {
    test('should work', async () => {
      const { service: pg } = await initPGMock();

      pg.transaction.mockResultOnce([{ rows: [], fields: {} }]);

      await pg.transaction(
        [
          'SELECT * FROM users WHERE id = $$userId',
          'SELECT * FROM users WHERE id = $$userId',
        ],
        { userId: 1 },
      );

      expect(pg.transaction.mock.calls).toMatchSnapshot();
    });

    test('should fail with lacking args', async () => {
      const { service: pg } = await initPGMock();

      pg.transaction.mockResultOnce([{ rows: [], fields: {} }]);

      try {
        await pg.transaction(['SELECT * FROM users WHERE id = $$userId'], {});
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect({
          errorCode: err.code,
          errorParams: err.params,
        }).toMatchSnapshot();
      }
    });
  });
});
