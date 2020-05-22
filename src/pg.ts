import { options, provider, autoInject } from 'knifecycle';
import { LogService } from 'common-services';
// @ts-ignore: no type atm  ¯\_(ツ)_/¯
import YError from 'yerror';
// @ts-ignore: no type atm  ¯\_(ツ)_/¯
import { Pool, types, PoolConfig, QueryResult } from 'pg';
// @ts-ignore: no type atm  ¯\_(ツ)_/¯
import { parse as parseConnectionURL } from 'pg-connection-string';

/* Architecture Note #1.3: Timezones

Ensure not messing with time zones with practical defaults.
See https://github.com/vitaly-t/pg-promise/issues/389

// TODO: Ensure arrays are well parsed too with `postgres-array` for
// 1115 - timestamp without time zone[]
// 1182 - date[]
*/

types.setTypeParser(1114, (str) =>
  str === null ? null : new Date(str.replace(' ', 'T') + 'Z'),
);
types.setTypeParser(1082, (str) =>
  str === null ? null : new Date(str + 'T00:00:00Z'),
);

type PG_CONFIG = PoolConfig;

export type PG_ENV = {
  PG_URL?: string;
};

export type PGServiceConfig = {
  ENV?: PG_ENV;
  PG: PG_CONFIG;
};

export type PGServiceDependencies = PGServiceConfig & {
  log?: LogService;
};

export interface PGService {
  query: (query: string, args: { [name: string]: any }) => Promise<QueryResult>;
  queries: (
    queries: string[],
    args: { [name: string]: any },
  ) => Promise<QueryResult[]>;
  transaction: (
    queries: string[],
    args: { [name: string]: any },
  ) => Promise<QueryResult[]>;
}

export interface PGProvider {
  service: PGService;
  errorPromise: Promise<void>;
  dispose: () => Promise<void>;
}

/* Architecture Note #1: PostgreSQL service

This service is a simple wrapper around the `pg` node module.

API Doc: https://node-postgres.com/features/pooling
*/

export default options(
  { singleton: true },
  provider(autoInject(initPGService), 'pg'),
  false,
);

/**
 * Instantiate the pg service
 * @name initPGService
 * @function
 * @param  {Object}   services           The services to inject
 * @param  {Function} [services.log]     A logging function
 * @param  {Object}   [services.ENV]     An environment object
 * @param  {Object}   services.PG      A `pg` compatible configuration object
 * @return {Promise<Object>}             A promise of the pg service
 * @example
 * import initPGService from 'postgresql-service';
 *
 * const { service: pg, dispose } = await initPGService({
 *   log: console.log.bind(console),
 *   ENV: process.env, // Proxy the PG_URL env var
 * });
 *
 * const result = pg.query('SELECT 1');
 *
 * await dispose();
 */
async function initPGService({
  ENV = {},
  PG,
  log = noop,
}: PGServiceDependencies): Promise<PGProvider> {
  const config = {
    ...PG,
    ...(ENV.PG_URL ? parseConnectionURL(ENV.PG_URL) : {}),
  };
  const pool = new Pool(config as PoolConfig);
  const pg = {
    query,
    queries,
    transaction,
  };
  const errorPromise: Promise<void> = new Promise((resolve, reject) => {
    pool.once('error', (err) => {
      const castedError = YError.wrap(err);
      log('error', 'Got a PG error:', castedError.stack);
      reject(castedError);
    });
  });
  log('debug', '🐘 - Initializing PG service...');

  return {
    service: pg,
    errorPromise,
    dispose: async () => {
      log('debug', '🐘 - Draining PG connections... 🐘');
      await pool.end();
      log('debug', '🐘 - PG connections drained ! 🐘');
    },
  };

  /**
   * Executes the given query
   * @return {String}   Query to execute
   * @return {Object}   Arguments hash for the query
   * @example
   * const { rows, fields } = await pg.query(
   *    'SELECT * FROM users WHERE user = $$userId',
   *    { userId: 1 }
   * );
   */
  async function query(query, args) {
    return (await pg.queries([query], args))[0];
  }
  /**
   * Executes the given queries in parallel (using the connections pool)
   * @return {Array<String>}   Queries to execute
   * @return {Object}          Arguments hashes for the queries
   * @example
   * const [{ rows, fields }, { rows2, fields2 }] = await pg.queries([
   *    'SELECT * FROM users WHERE user = $$userId',
   *    'SELECT * FROM users WHERE user = $$userId',
   * ], { userId: 1 });
   */
  async function queries(queries, args) {
    const client = await pool.connect();
    let results;

    try {
      results = await Promise.all(
        queries.map(async (query) => {
          const { preparedQuery, preparedArgs } = prepareQuery(query, args);

          try {
            return client.query(preparedQuery, preparedArgs);
          } catch (err) {
            castPGQueryError(err, query, args);
          }
        }),
      );
    } finally {
      await client.release();
    }
    return results;
  }
  /**
   * Executes the given queries in a single transaction
   * @return {Array<String>}   Queries to execute
   * @return {Object}          Arguments hashes for the queries
   * @example
   * const [, { rows, fields }] = await pg.transaction([
   *    'UPDATE users SET isActive = true WHERE user = $$userId',
   *    'SELECT * FROM users WHERE user = $$userId',
   * ], { userId: 1 });
   */
  async function transaction(queries, args) {
    const client = await pool.connect();
    let results;

    try {
      await client.query('BEGIN');
      try {
        results = await Promise.all(
          queries.map((query) => {
            const { preparedQuery, preparedArgs } = prepareQuery(query, args);

            try {
              return client.query(preparedQuery, preparedArgs);
            } catch (err) {
              castPGQueryError(err, query, args);
            }
          }),
        );
      } catch (err) {
        const castedError = YError.cast(err, 'E_PG_TRANSACTION', queries, args);
        await client.query('ROLLBACK');
        throw castedError;
      }
      await client.query('COMMIT');
    } finally {
      await client.release();
    }

    return results;
  }
}

/* Architecture Note #1.1: Prepared queries

The `pg` module uses simple `$n` placeholder for queries values
 that are provided in an array.

 This function adds a level of abstraction that refers to fields
 in an object instead, transforming a query executions like
 `SELECT * FROM users WHERE id=$$userId` with { userId: 1 }
 into `SELECT * FROM users WHERE id=$1` with [1] under the
 hood.

It also adds check to ensure the provided arguments exists.
*/
export function prepareQuery(query, args) {
  let argsCount = 0;
  const argsHash = {};
  const preparedQuery = query.replace(/\$\$([a-zA-Z0-9_]+)/gm, (_, prop) => {
    if ('undefined' === typeof args[prop]) {
      throw new YError('E_PG_LACKING_ARG', query, args, prop);
    }
    if ('undefined' === typeof argsHash[prop]) {
      argsHash[prop] = argsCount++;
    }
    return `$${argsHash[prop] + 1}`;
  });

  const preparedArgs = new Array(argsCount)
    .fill('')
    .map(
      (_, index) =>
        args[Object.keys(argsHash).find((key) => argsHash[key] === index)],
    );
  return { preparedQuery, preparedArgs };
}

/* Architecture Note #1.2: Errors casting

This service also convert `pg` errors into `yerror` ones which taste
 better imo.
*/
function castPGQueryError(err, query, args) {
  throw YError.wrap(err, 'E_PG_QUERY', query, args, {
    code: err.code,
    detail: err.detail,
    schema: err.schema,
    table: err.table,
    constraint: err.constraint,
    file: err.file,
    line: err.line,
    routine: err.routine,
  });
}

function noop() {}
