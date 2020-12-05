import { singleton, provider, autoInject } from 'knifecycle';
import YError from 'yerror';
import pgConnectionString from 'pg-connection-string';
import pg from 'pg';
import type { PoolConfig, QueryResult } from 'pg';
import type { LogService } from 'common-services';

// Required to work as a MJS module. Will be turnable
// into real imports when those module will support MJS
const { Pool, types } = pg;
const { parse: parseConnectionURL } = pgConnectionString;

/* Architecture Note #1.2: Timezones

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

const DEFAULT_ENV: PG_ENV = {};

export const DEFAULT_PG_URL_ENV_NAME = 'PG_URL';

type PG_CONFIG = PoolConfig;
type SQLValue = any;

export type PG_ENV = {
  PG_URL?: string;
  [name: string]: string;
};

export type PGServiceConfig = {
  PG_URL_ENV_NAME?: string;
  ENV?: PG_ENV;
  PG: PG_CONFIG;
};

export type PGServiceDependencies = PGServiceConfig & {
  log?: LogService;
};

export type PGQuery = {
  text: string;
  values: SQLValue[];
};

export interface PGService {
  query: (query: PGQuery) => Promise<QueryResult>;
  queries: (queries: PGQuery[]) => Promise<QueryResult[]>;
  transaction: (queries: PGQuery[]) => Promise<QueryResult[]>;
}

export interface PGProvider {
  service: PGService;
  errorPromise: Promise<void>;
  dispose: () => Promise<void>;
}

/* Architecture Note #1: PostgreSQL service

This service is a simple wrapper around the `pg` node module
 that adds native support for transsactions and a few tweaks
 for a better plug and play experience.

Its goal is to expose only a subset of its capabilities to
 reduce the API surface to 3 use cases:
- run a single query
- run several queries in parallel
- run several queries into a single transaction

And that's it ;). The purpose is to know SQL, not an ORM, and
 have an easily mockable API surface.

PG module API Doc: https://node-postgres.com/features/pooling
*/

export default singleton(provider(autoInject(initPGService), 'pg'));

/**
 * Instantiate the pg service
 * @name initPGService
 * @function
 * @param  {Object}   services
 * The services to inject
 * @param  {Function} [services.log]
 * A logging function
 * @param  {Object}   [services.PG_URL_ENV_NAME]
 * The environment variable name in which to pick-up the
 *  PG url
 * @param  {Object}   [services.ENV]
 * An environment object
 * @param  {Object}   services.PG
 * A `pg` compatible configuration object
 * @return {Promise<Object>}
 * A promise of the pg service
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
  PG_URL_ENV_NAME = DEFAULT_PG_URL_ENV_NAME,
  ENV = DEFAULT_ENV,
  PG,
  log = noop,
}: PGServiceDependencies): Promise<PGProvider> {
  const config = {
    ...PG,
    ...(ENV[PG_URL_ENV_NAME] ? parseConnectionURL(ENV[PG_URL_ENV_NAME]) : {}),
  };
  const pool = new Pool(config as PoolConfig);
  const pg = {
    query,
    queries,
    transaction,
  };
  const errorPromise = new Promise<void>((resolve, reject) => {
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
  async function query(query: PGQuery) {
    return (await pg.queries([query]))[0];
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
  async function queries(queries: PGQuery[]) {
    const client = await pool.connect();
    let results;

    try {
      results = await Promise.all(
        queries.map(async (query, index) => {
          try {
            return await client.query(query);
          } catch (err) {
            throw castPGQueryError(err, query.text, query.values, index);
          }
        }),
      );
    } catch (err) {
      const castedError = YError.cast(
        err,
        'E_PG_QUERIES',
        queries.map((query) => query.text),
        queries.map((query) => query.values),
        err.code === 'E_PG_QUERY'
          ? err.params && typeof err.params[2] === 'object'
            ? err.params[2]
            : {}
          : {},
      );

      throw castedError;
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
  async function transaction(queries: PGQuery[]) {
    const client = await pool.connect();
    let results;

    try {
      await client.query('BEGIN');
      try {
        results = await Promise.all(
          queries.map(async (query, index) => {
            try {
              return await client.query(query);
            } catch (err) {
              throw castPGQueryError(err, query.text, query.values, index);
            }
          }),
        );
      } catch (err) {
        const castedError = YError.cast(
          err,
          'E_PG_TRANSACTION',
          queries.map((query) => query.text),
          queries.map((query) => query.values),
          err.code === 'E_PG_QUERY'
            ? err.params && typeof err.params[2] === 'object'
              ? err.params[2]
              : {}
            : {},
        );

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

/* Architecture Note #1.1: Errors casting

This service also convert `pg` errors into `yerror` ones which taste
 better imo.
*/
function castPGQueryError(
  err: Error,
  query: string,
  args: any[],
  index: number,
) {
  return YError.wrap(err, 'E_PG_QUERY', query, args, {
    index,
    code: (err as any).code || undefined,
    name: (err as any).name || undefined,
    severity: (err as any).severity || undefined,
    detail: (err as any).detail || undefined,
    schema: (err as any).schema || undefined,
    table: (err as any).table || undefined,
    column: (err as any).column || undefined,
    dataType: (err as any).dataType || undefined,
    constraint: (err as any).constraint || undefined,
    file: (err as any).file || undefined,
    line: (err as any).line || undefined,
    routine: (err as any).routine || undefined,
  });
}

function noop(...args: unknown[]): void {
  args;
}
