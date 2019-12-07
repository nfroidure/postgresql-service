# API
## Members

<dl>
<dt><a href="#default">default</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Instantiate the pg service</p>
</dd>
<dt><a href="#default">default</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Instantiate the pg service mock</p>
</dd>
</dl>

<a name="default"></a>

## default ⇒ <code>Promise.&lt;Object&gt;</code>
Instantiate the pg service

**Kind**: global variable  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise of the pg service  

| Param | Type | Description |
| --- | --- | --- |
| services | <code>Object</code> | The services to inject |
| [services.log] | <code>function</code> | A logging function |
| [services.ENV] | <code>Object</code> | An environment object |
| [services.PG] | <code>Object</code> | A `pg` compatible configuration object |

**Example**  
```js
import initPGService from 'postgresql-service';

const { service: pg, dispose } = await initPGService({
  log: console.log.bind(console),
  ENV: process.env, // Proxy the PG_URL env var
});

const result = pg.query('SELECT 1');

await dispose();
```
<a name="default"></a>

## default ⇒ <code>Promise.&lt;Object&gt;</code>
Instantiate the pg service mock

**Kind**: global variable  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise of the mocked pg service stubbed with Jest  
**Example**  
```js
import initPGMock from 'postgresql-service/src/pg.mock';
import assert from 'assert';

const { service: pg, mocksClear } = await initPGMock();

// Let's returns Thomas birth date (OMG ya father
// talking me about its childrens :D).
pg.query.mockResolvedValueOnce({ rows: [[1]], fields: {}});

assert.deepEqual(pg.mock.calls, [[
   'SELECT 1'
]], 'Called once');

mocksClear();

assert.deepEqual(pg.mock.calls, []);
```
