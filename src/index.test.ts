import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initPGService, { type PGService } from './index.js';
import { type LogService } from 'common-services';

describe('initPGService', () => {
  const log = jest.fn<LogService>();
  const PG = {};

  beforeEach(() => {
    log.mockClear();
  });

  describe('pg', () => {
    test('should work without envname', async () => {
      const pg = await initPGService({
        PG: { ...PG, password: 'a_pwd' },
        log,
      });

      expect(pg).toBeDefined();
      expect(log.mock.calls).toMatchSnapshot();
    });

    test('should work with envname', async () => {
      const pg = await initPGService({
        PG_URL_ENV_NAME: 'YOLO',
        ENV: {
          YOLO: 'myurl',
        },
        PG,
        log,
      });

      expect(pg).toBeDefined();
      log.mockClear();

      expect(log.mock.calls).toMatchSnapshot();
    });
  });

  test('should work with Knifecycle', async () => {
    const $ = new Knifecycle()
      .register(initPGService)
      .register(constant('log', log))
      .register(constant('PG', {}))
      .register(constant('ENV', { PG_URL: 'a_pg_url' }));
    const { pg } = await $.run<{ pg: PGService }>(['pg']);

    expect(pg).toBeDefined();
    expect(log.mock.calls).toMatchSnapshot();
  });
});
