import YError from 'yerror';
import initPGService from './pg';
import { reuseSpecialProps } from 'knifecycle/dist/util';
import { prepareQuery } from './pg';
import { parse } from 'pg-query-parser';

/* Architecture Note #1.2.1: Mocking pg

The pg mock uses the [`jest`](https://jestjs.io) under the hood.
 You will have to use Jest to use it.

Its purpose it to ensure queries are well formed while mocking
 in the tests and that the values placeholder really have a value
 associated to it in the values hash.
*/

export default reuseSpecialProps(initPGService, initPGMock);

/**
 * Instantiate the pg service mock
 * @return {Promise<Object>}
 * A promise of the mocked pg service stubbed with Jest
 * @example
 * import initPGMock from 'postgresql-service/src/pg.mock';
 * import assert from 'assert';
 *
 * const { service: pg, mocksClear } = await initPGMock();
 *
 * // Let's returns Thomas birth date (OMG ya father
 * // talking me about its childrens :D).
 * pg.query.mockResolvedValueOnce({ rows: [[1]], fields: {}});
 *
 * assert.deepEqual(pg.mock.calls, [[
 *    'SELECT 1'
 * ]], 'Called once');
 *
 * mocksClear();
 *
 * assert.deepEqual(pg.mock.calls, []);
 */
async function initPGMock() {
  const pgProvider = {
    service: {
      query: buildMockImplementation(jest.fn()),
      queries: buildMockImplementation(jest.fn()),
      transaction: buildMockImplementation(jest.fn()),
    },
    dispose: jest.fn(),
    errorPromise: new Promise(() => {}),
    mocksClear: () => {
      pgProvider.service.query.mockClear();
      pgProvider.service.queries.mockClear();
      pgProvider.service.transaction.mockClear();
      pgProvider.dispose.mockClear();
    },
  };

  return pgProvider;
}

function buildMockImplementation(jestFn) {
  jestFn.mockResultOnce = (result) =>
    jestFn.mockImplementationOnce((queries, args) => {
      (queries instanceof Array ? queries : [queries]).forEach((query) => {
        const { preparedQuery, preparedArgs } = prepareQuery(query, args);
        const builtQuery = preparedQuery.replace(/\$(\d+)/g, (_, num) => {
          const index = parseInt(num, 10) - 1;

          if (
            typeof preparedArgs[index] === 'boolean' ||
            typeof preparedArgs[index] === 'number'
          ) {
            return preparedArgs[index].toString();
          }

          if (null === preparedArgs[index]) {
            return null;
          }

          return `'${preparedArgs[index].toString().replace(/'/g, "''")}'`;
        });

        const result = parse(builtQuery);
        if (result.error) {
          throw new YError('E_INVALID_QUERY', builtQuery, result.error);
        }
      });
      return result;
    });
  return jestFn;
}
