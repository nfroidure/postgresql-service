# API
## Functions

<dl>
<dt><a href="#initPGService">initPGService(services)</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Instantiate the pg service</p>
</dd>
<dt><a href="#initPGMock">initPGMock()</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Instantiate the pg service mock</p>
</dd>
</dl>

<a name="initPGService"></a>

## initPGService(services) ⇒ <code>Promise.&lt;Object&gt;</code>
Instantiate the pg service

**Kind**: global function  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise of the pg service  

| Param | Type | Description |
| --- | --- | --- |
| services | <code>Object</code> | The services to inject |
| [services.log] | <code>function</code> | A logging function |
| [services.ENV] | <code>Object</code> | An environment object |
| [services.PG] | <code>Object</code> | A `pg` compatible configuration object |

**Example**  
```js
import initPGService from 'pg-service';

const { service: pg, dispose } = await initPGService({
  log: console.log.bind(console),
  ENV: process.env, // Proxy the PG_URL env var
});

const result = pg.query('SELECT 1');

await dispose();
```

* [initPGService(services)](#initPGService) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [~query()](#initPGService..query) ⇒ <code>String</code> \| <code>Object</code>
    * [~queries()](#initPGService..queries) ⇒ <code>Array.&lt;String&gt;</code> \| <code>Object</code>
    * [~transaction()](#initPGService..transaction) ⇒ <code>Array.&lt;String&gt;</code> \| <code>Object</code>

<a name="initPGService..query"></a>

### initPGService~query() ⇒ <code>String</code> \| <code>Object</code>
Executes the given query

**Kind**: inner method of [<code>initPGService</code>](#initPGService)  
**Returns**: <code>String</code> - Query to execute<code>Object</code> - Arguments hash for the query  
**Example**  
```js
const { rows, fields } = await pg.query(
   'SELECT * FROM users WHERE user = $$userId',
   { userId: 1 }
);
```
<a name="initPGService..queries"></a>

### initPGService~queries() ⇒ <code>Array.&lt;String&gt;</code> \| <code>Object</code>
Executes the given queries in parallel (using the connections pool)

**Kind**: inner method of [<code>initPGService</code>](#initPGService)  
**Returns**: <code>Array.&lt;String&gt;</code> - Queries to execute<code>Object</code> - Arguments hashes for the queries  
**Example**  
```js
const { rows, fields } = await pg.queries([
   'SELECT * FROM users WHERE user = $$userId',
   'SELECT * FROM users WHERE user = $$userId',
], { userId: 1 });
```
<a name="initPGService..transaction"></a>

### initPGService~transaction() ⇒ <code>Array.&lt;String&gt;</code> \| <code>Object</code>
Executes the given queries in a single transaction

**Kind**: inner method of [<code>initPGService</code>](#initPGService)  
**Returns**: <code>Array.&lt;String&gt;</code> - Queries to execute<code>Object</code> - Arguments hashes for the queries  
**Example**  
```js
const [, { rows, fields }] = await pg.transaction([
   'UPDATE users SET isActive = true WHERE user = $$userId',
   'SELECT * FROM users WHERE user = $$userId',
], { userId: 1 });
```
<a name="initPGMock"></a>

## initPGMock() ⇒ <code>Promise.&lt;Object&gt;</code>
Instantiate the pg service mock

**Kind**: global function  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise of the mocked pg service stubbed with Jest  
**Example**  
```js
import initPGMock from 'pg-service/src/pg.mock';
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
