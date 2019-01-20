import { LogService } from 'common-services';
import { PoolConfig, QueryResult } from 'pg';
declare type PG_CONFIG = PoolConfig;
interface PG_ENV {
  PG_URL?: string;
}
interface PGServiceDependencies {
  ENV?: PG_ENV;
  PG: PG_CONFIG;
  log?: LogService;
}
export interface PGService {
  query: (
    query: string,
    args: {
      [name: string]: any;
    },
  ) => Promise<QueryResult>;
  queries: (
    queries: string[],
    args: {
      [name: string]: any;
    },
  ) => Promise<QueryResult[]>;
  transaction: (
    queries: string[],
    args: {
      [name: string]: any;
    },
  ) => Promise<QueryResult[]>;
}
export interface PGProvider {
  service: PGService;
  errorPromise: Promise<void>;
  dispose: () => Promise<void>;
}
declare const _default: typeof initPGService;
export default _default;
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
declare function initPGService({
  ENV,
  PG,
  log,
}: PGServiceDependencies): Promise<PGProvider>;
export declare function prepareQuery(
  query: any,
  args: any,
): {
  preparedQuery: any;
  preparedArgs: any[];
};
