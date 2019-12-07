import assert from 'assert';
import { Knifecycle, constant } from 'knifecycle';
import initPGService, { PGService } from './pg';

describe('initPGService', () => {
  const log = jest.fn();
  const ENV = {};
  const PG = {};

  beforeEach(() => {
    log.mockClear();
  });

  test('should work', async () => {
    const pg = await initPGService({
      ENV,
      PG,
      log,
    });

    assert(pg);
    expect(log.mock.calls).toMatchSnapshot();
  });

  describe('pg', () => {
    test('should work', async () => {
      const pg = await initPGService({
        ENV,
        PG,
        log,
      });

      assert(pg);
      log.mockClear();

      expect(log.mock.calls).toMatchSnapshot();
    });
  });

  test('should work with Knifecycle', async () => {
    const $ = new Knifecycle()
      .register(initPGService)
      .register(constant('log', log))
      .register(constant('PG', {}));
    const { pg } = await $.run<{ pg: PGService }>(['pg']);

    assert(pg);
    expect(log.mock.calls).toMatchSnapshot();
  });
});
