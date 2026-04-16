import assert from 'node:assert/strict';
import test from 'node:test';

import D1Tags from '../index.js';
import { createFakeD1 } from './fake-d1.js';

/**
 * Build a {@link TemplateStringsArray} for guard tests (real tag sites always pass frozen arrays).
 * @param {readonly string[]} strings
 * @returns {TemplateStringsArray}
 */
function fakeTemplateStrings(strings) {
  const cooked = [...strings];
  Object.defineProperty(cooked, 'raw', { value: Object.freeze([...strings]) });
  return /** @type {TemplateStringsArray} */ (/** @type {unknown} */ (cooked));
}

test('escape quotes single quotes like SQL string literals', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  assert.equal(tags.escape("a'b"), "'a''b'");
  assert.equal(tags.escape(42), "'42'");
  assert.equal(calls.prepareSql.length, 0);
});

test('run uses template.join(?) and binds fields', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  const id = 7;
  await tags.run`SELECT * FROM u WHERE id = ${id}`;
  assert.deepEqual(calls.prepareSql, ['SELECT * FROM u WHERE id = ?']);
  assert.deepEqual(calls.runs, [{ sql: 'SELECT * FROM u WHERE id = ?', bindArgs: [7] }]);
});

test('first tagged template calls prepare + bind + first()', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.first`SELECT 1 AS x`;
  assert.deepEqual(calls.prepareSql, ['SELECT 1 AS x']);
});

test('first curried forwards bound value into first(...extra)', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.first('name')`SELECT * FROM t WHERE id = ${1}`;
  assert.deepEqual(calls.prepareSql, ['SELECT * FROM t WHERE id = ?']);
});

test('raw tagged template', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.raw`SELECT 1`;
  assert.deepEqual(calls.prepareSql, ['SELECT 1']);
});

test('raw with columnNames option (curried)', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.raw({ columnNames: true })`SELECT 1 AS a`;
  assert.deepEqual(calls.prepareSql, ['SELECT 1 AS a']);
});

test('exec concatenates template parts with String(field)', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.exec`UPDATE t SET x = ${'y'} WHERE id = ${2}`;
  assert.deepEqual(calls.execSql, ['UPDATE t SET x = y WHERE id = 2']);
});

test('batch maps each row with bind on one prepared statement', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  const customers = tags.map([
    { id: 1, name: 'Alice', company: 'A' },
    { id: 2, name: 'Bob', company: 'B' },
    { id: 3, name: 'Carol', company: 'C' },
  ]);
  await tags.batch`INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (${customers.id}, ${customers.company}, ${customers.name})`;
  assert.deepEqual(calls.prepareSql, ['INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)']);
  assert.equal(calls.batchRuns.length, 1);
  assert.deepEqual(calls.batchRuns[0], [
    { sql: 'INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)', bindArgs: [1, 'A', 'Alice'] },
    { sql: 'INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)', bindArgs: [2, 'B', 'Bob'] },
    { sql: 'INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)', bindArgs: [3, 'C', 'Carol'] },
  ]);
});

test('batch throws SyntaxError when a row is not an array', async () => {
  const { db } = createFakeD1();
  const tags = D1Tags(db);
  await assert.rejects(
    async () => {
      await tags.batch`INSERT INTO t VALUES (?)${'bad'}`;
    },
    (err) => err instanceof SyntaxError && /Invalid batch/.test(/** @type {Error} */ (err).message),
  );
});

test('guard rejects unfrozen template array', async () => {
  const { db } = createFakeD1();
  const tags = D1Tags(db);
  const t = fakeTemplateStrings(['SELECT 1', '']);
  assert.ok(!Object.isFrozen(t));
  await assert.rejects(
    async () => {
      await tags.run(t, 1);
    },
    (err) => err instanceof SyntaxError && /Invalid template/.test(/** @type {Error} */ (err).message),
  );
});

test('guard rejects arity mismatch', async () => {
  const { db } = createFakeD1();
  const tags = D1Tags(db);
  const t = Object.freeze(fakeTemplateStrings(['SELECT ', ' AND ', '']));
  await assert.rejects(
    async () => {
      await tags.run(t, 1);
    },
    (err) => err instanceof SyntaxError && /Invalid template/.test(/** @type {Error} */ (err).message),
  );
});

test('same tagged-template site reuses one prepare (WeakMap cache)', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  const runTwice = (v) => tags.run`SELECT v FROM t WHERE id = ${v}`;
  await runTwice(1);
  await runTwice(2);
  assert.deepEqual(calls.prepareSql, ['SELECT v FROM t WHERE id = ?']);
  assert.equal(calls.prepareSql.length, 1);
  assert.equal(calls.runs.length, 2);
  assert.deepEqual(calls.runs[0].bindArgs, [1]);
  assert.deepEqual(calls.runs[1].bindArgs, [2]);
});

test('different tagged-template sites produce different prepare calls', async () => {
  const { db, calls } = createFakeD1();
  const tags = D1Tags(db);
  await tags.run`SELECT ${1}`;
  await tags.run`SELECT ${2}`;
  assert.deepEqual(calls.prepareSql, ['SELECT ?', 'SELECT ?']);
});
