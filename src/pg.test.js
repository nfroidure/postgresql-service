import assert from 'assert';
import { Knifecycle } from 'knifecycle';
import initPGService from './pg';

describe('initPGService', () => {
  const log = jest.fn();
  const ENV = {};
  const PG = {};

  beforeEach(() => {
    log.mockClear();
  });

  test('should work', done => {
    initPGService({
      ENV,
      PG,
      log,
    })
      .then(pg => {
        assert(pg);
        expect(log.mock.calls).toMatchSnapshot();
      })
      .then(() => done())
      .catch(done);
  });

  describe('pg', () => {
    test('should work', done => {
      initPGService({
        ENV,
        PG,
        log,
      })
        .then(pg => {
          assert(pg);
          log.mockClear();

          expect(log.mock.calls).toMatchSnapshot();
        })
        .then(() => done())
        .catch(done);
    });
  });

  test('should work with Knifecycle', done => {
    new Knifecycle()
      .register(initPGService)
      .constant('log', log)
      .run(['pg'])
      .then(({ pg }) => {
        assert(pg);
        expect(log.mock.calls).toMatchSnapshot();
      })
      .then(() => done())
      .catch(done);
  });
});
